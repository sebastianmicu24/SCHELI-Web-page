<svelte:head>
  <title>Manual Cell Classifier</title>
  <meta name="description" content="Manual Cell Classifier Page" />
</svelte:head>

    import './styles.css';
    <div class="container">
        <h1>Cell Selection Tool</h1>

        <div class="controls">
            <div class="control-group">
                <h3>Input Files</h3>
                <div>
                    <label class="file-input-label" for="imageFolderInput">Choose Image Folder</label>
                    <input type="file" id="imageFolderInput" webkitdirectory directory multiple>
                </div>
                <select id="imageDropdown" style="display: none;"></select>

                <div>
                    <label class="file-input-label" for="csvFolderInput">Choose Cell Data Folder</label>
                    <input type="file" id="csvFolderInput" webkitdirectory directory multiple>
                </div>
                <select id="csvDropdown" style="display: none;"></select>
            </div>

            <div class="control-group">
                <h3>Display Settings</h3>
                <div class="settings-group">
                  <div class="setting-row">
                        <label for="globalScale">Scale:</label>
                        <input type="number" id="globalScale" value="0.29" step="0.01" min="0.01" max="2">
                    </div>
                     <div class="setting-row">
                        <label for="borderWidth">Border Width:</label>
                        <input type="number" id="borderWidth" value="2" step="0.5" min="0">
                    </div>
                    <div class="setting-row">
                        <label for="fillOpacity">Fill Opacity:</label>
                        <input type="number" id="fillOpacity" value="0.2" step="0.05" min="0" max="1">
                    </div>
                </div>

                <div class="zoom-controls">
                     <label>Zoom:</label>
                    <button id="zoomOut">-</button>
                    <span id="zoomLevel">100%</span>
                    <button id="zoomIn">+</button>
                    <button id="resetZoom">Reset</button>
                </div>
            </div>
        </div>
         <div class="class-controls">
            <input type="color" id="classColor" value="#ff0000">
            <span class="color-preview" id="colorPreview"></span> <!-- Add color preview -->
            <input type="text" id="className" placeholder="Enter class name">
            <button id="addClassBtn">Add Class</button>
            <select id="classSelect">
                <option value="Unclassified" style="background-color: #3d3d3d; color: white;">Unclassified</option>
            </select>
        </div>

           <div class="counters-container" id="countersContainer">
            <!-- Class counters will be added here -->
        </div>

        <div class="canvas-container" id="scrollContainer">
            <canvas id="canvas"></canvas>
        </div>

         <div class="save-load-buttons">
            <button id="saveData">Save Classification</button>
            <button id="loadData">Load Classification</button>
        </div>
    </div>

    <script>
        // Global variables
        let backgroundImage = null;
        let imageScaleInfo = null;
        let data = null;
        let classificationData = { classes: {} };
        let imageFiles = [];
        let csvFiles = [];
        let currentImageFile = null;
        let currentCsvFile = null;
        let zoomFactor = 1;

        // --- Display Settings ---
        const borderWidthInput = document.getElementById('borderWidth');
        const fillOpacityInput = document.getElementById('fillOpacity');
        let borderWidth = parseFloat(borderWidthInput.value) || 2;  // Initial border width from input
        let fillOpacity = parseFloat(fillOpacityInput.value) || 0.2; // Initial fill opacity from input

        // --- 'E' Key Toggle Variables ---
        let outlinesHidden = false;
        let originalBorderWidth = borderWidth; // Store initial value
        let originalFillOpacity = fillOpacity; // Store initial value


        // --- Event listeners ---
        document.getElementById('imageFolderInput').addEventListener('change', handleImageFolder);
        document.getElementById('imageDropdown').addEventListener('change', handleImageSelection);
        document.getElementById('csvFolderInput').addEventListener('change', handleCSVFolder);
        document.getElementById('csvDropdown').addEventListener('change', handleCSVSelection);
        document.getElementById('globalScale').addEventListener('input', redrawCanvas);
        borderWidthInput.addEventListener('input', handleStyleChange); // Use const variable
        fillOpacityInput.addEventListener('input', handleStyleChange); // Use const variable
        document.getElementById('classColor').addEventListener('input', (event) => {
            document.getElementById('colorPreview').style.backgroundColor = event.target.value;
        });

        // Initialize the preview on load
        document.getElementById('colorPreview').style.backgroundColor = document.getElementById('classColor').value;

        // --- Zoom controls ---
        document.getElementById('zoomIn').addEventListener('click', () => {
            zoomFactor *= 1.2;
            updateZoomDisplay();
            redrawCanvas();
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            zoomFactor /= 1.2;
            if (zoomFactor < 0.1) zoomFactor = 0.1;
            updateZoomDisplay();
            redrawCanvas();
        });

        document.getElementById('resetZoom').addEventListener('click', () => {
            zoomFactor = 1;
            updateZoomDisplay();
            redrawCanvas();
        });

        function updateZoomDisplay() {
            document.getElementById('zoomLevel').textContent = `${Math.round(zoomFactor * 100)}%`;
        }

        function handleStyleChange() {
            // Update current values from input fields
            borderWidth = parseFloat(borderWidthInput.value) || 0; // Allow 0
            fillOpacity = parseFloat(fillOpacityInput.value) || 0;   // Allow 0

            // If user manually changes style, update the 'original' values too
            // and assume they want to exit the 'hidden' state if it was active.
            originalBorderWidth = borderWidth;
            originalFillOpacity = fillOpacity;
            outlinesHidden = false; // Exit hidden mode on manual change

            redrawCanvas(); // Redraw to apply changes
        }

        // Scroll event for viewport tracking
        const scrollContainer = document.getElementById('scrollContainer');
        scrollContainer.addEventListener('scroll', redrawCanvas);


        // --- Add class button ---
        document.getElementById('addClassBtn').addEventListener('click', () => {
            const colorInput = document.getElementById('classColor');
            const nameInput = document.getElementById('className');

            if (!nameInput.value.trim()) return;

            const className = nameInput.value.trim();
            const color = colorInput.value;

            // Add to class select dropdown
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            option.style.backgroundColor = color;

            // Set text color based on background brightness
            const hex = color.slice(1);
            const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.substr(i, 2), 16));
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
            option.style.color = luminance < 128 ? 'white' : 'black';

            document.getElementById('classSelect').appendChild(option);

            // Add to classification data
            if (!classificationData.classes[className]) {
                classificationData.classes[className] = {
                    color: color,
                    id: Object.keys(classificationData.classes).length + 1,
                    particles: {}
                };
            }

            nameInput.value = '';
            updateClassCounters(); // update counters after adding class
        });

        // --- Canvas click handler ---
        document.getElementById('canvas').addEventListener('click', (event) => {
           if (!data || !imageScaleInfo || !currentCsvFile) return;

            const rect = event.target.getBoundingClientRect();
            const mouseX = (event.clientX - rect.left) / zoomFactor;
            const mouseY = (event.clientY - rect.top) / zoomFactor;

            const { scale, offsetX, offsetY } = imageScaleInfo;
            const globalScale = parseFloat(document.getElementById('globalScale').value) || 1;
            const selectedClass = document.getElementById('classSelect').value;
            const selectedOption = document.getElementById('classSelect').selectedOptions[0];
            const selectedColor = selectedOption.style.backgroundColor || '#3d3d3d';

            const invGlobalScale = 1.0 / globalScale;
            const scaleFactor = invGlobalScale * scale;

             // Find clicked particle - using for...of loop for potential performance benefit if we can break early
            for (const [index, row] of data.slice(1).entries()) {

              const headers = data[0];
              const n = Object.fromEntries(headers.map((header, i) => [header, row[i]])); // More concise object creation.

                const xValue = parseFloat(n.X);
                const yValue = parseFloat(n.Y);
                const majorValue = parseFloat(n.Major);
                const minorValue = parseFloat(n.Minor);

                if (isNaN(xValue) || isNaN(yValue)) continue;

                const originalMajor = majorValue * scaleFactor;
                const originalMinor = minorValue * scaleFactor;
                const originalX = xValue * scaleFactor + offsetX;
                const originalY = yValue * scaleFactor + offsetY;

                 // More accurate ellipse hit testing (approximation)
                const distSq = Math.pow((mouseX - originalX), 2) / Math.pow(originalMajor / 2, 2) +
                               Math.pow((mouseY - originalY), 2) / Math.pow(originalMinor / 2, 2);

                if (distSq <= 1) { // Point is inside or on the ellipse boundary
                    const fullParticleId = row[0];
                    const particleId = String(fullParticleId).replace(/^Nucleus_/i, '');
                    const filename = currentCsvFile.name;

                    // Classify or unclassify the particle
                    if (selectedClass !== 'Unclassified') {
                        if (!classificationData.classes[selectedClass].particles[filename]) {
                            classificationData.classes[selectedClass].particles[filename] = [];
                        }

                        Object.keys(classificationData.classes).forEach(cls => {
                            if (cls !== selectedClass && classificationData.classes[cls].particles[filename]) {
                                classificationData.classes[cls].particles[filename] = classificationData.classes[cls].particles[filename].filter(id => id !== particleId);
                            }
                        });

                        if (!classificationData.classes[selectedClass].particles[filename].includes(particleId)) {
                            classificationData.classes[selectedClass].particles[filename].push(particleId);
                        }
                    } else {
                        Object.keys(classificationData.classes).forEach(cls => {
                            if (classificationData.classes[cls].particles[filename]) {
                                classificationData.classes[cls].particles[filename] = classificationData.classes[cls].particles[filename].filter(id => id !== particleId);
                            }
                        });
                    }

                    redrawCanvas();
                    updateClassCounters(); // Update counters after click
                    return; // Exit loop after finding the particle.
                }
            }
        });

        //Update class counters
        function updateClassCounters() {
            const countersContainer = document.getElementById('countersContainer');
            countersContainer.innerHTML = ''; // Clear previous counters

            // Add counters for defined classes
            for (const className in classificationData.classes) {
                if (!classificationData.classes.hasOwnProperty(className)) continue; // Ensure it's not from prototype

                const classInfo = classificationData.classes[className];
                const counterDiv = document.createElement('div');
                counterDiv.classList.add('class-counter');
                counterDiv.style.backgroundColor = classInfo.color;
                const hex =  classInfo.color.slice(1);
                const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.substr(i, 2), 16));
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
                counterDiv.style.color = luminance < 128 ? 'white' : 'black';


                let count = 0;
                 // Count particles across all files for this class
                 // Use optional chaining for safety in case particles object is missing for a file
                for (const filename in classInfo.particles) {
                     if (classInfo.particles.hasOwnProperty(filename)) { // Check ownership
                        count += classInfo.particles[filename]?.length || 0; // Safely access length
                     }
                }


                counterDiv.textContent = `${className}: ${count}`;
                countersContainer.appendChild(counterDiv);
            }

             // Add unclassified counter for the *current* file
            const unclassifiedCounterDiv = document.createElement('div');
            unclassifiedCounterDiv.classList.add('class-counter');
            unclassifiedCounterDiv.style.backgroundColor = '#3d3d3d';
            unclassifiedCounterDiv.style.color = 'white';
            let unclassifiedCount = 0;

            if (data && data.length > 1 && currentCsvFile) { // Check if data is loaded and has rows
                const totalParticles = data.length - 1; // Exclude header row
                let classifiedCountCurrentFile = 0;

                const filename = currentCsvFile.name;
                for (const className in classificationData.classes) {
                     if (classificationData.classes.hasOwnProperty(className)) { // Check ownership
                        const classInfo = classificationData.classes[className];
                        // Use optional chaining and nullish coalescing
                        classifiedCountCurrentFile += classInfo.particles?.[filename]?.length ?? 0;
                    }
                }
                // Ensure unclassified count isn't negative if something went wrong
                unclassifiedCount = Math.max(0, totalParticles - classifiedCountCurrentFile);

            }
            unclassifiedCounterDiv.textContent = `Unclassified: ${unclassifiedCount}`;
            countersContainer.appendChild(unclassifiedCounterDiv);
        }


        // --- 'E' Key Listener ---
        document.addEventListener('keydown', (event) => {
            // Ignore if typing in an input field or select box
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
                return;
            }

            if (event.key.toLowerCase() === 'e') {
                event.preventDefault(); // Prevent potential browser shortcuts if 'e' is pressed elsewhere

                if (outlinesHidden) {
                    // Restore original values
                    borderWidth = originalBorderWidth;
                    fillOpacity = originalFillOpacity;
                    outlinesHidden = false;
                } else {
                    // Store current values before hiding
                    originalBorderWidth = borderWidth;
                    originalFillOpacity = fillOpacity;
                    // Hide outlines
                    borderWidth = 0;
                    fillOpacity = 0;
                    outlinesHidden = true;
                }

                // Update UI input fields to reflect the change
                borderWidthInput.value = borderWidth;
                fillOpacityInput.value = fillOpacity;

                // Redraw the canvas with new settings
                redrawCanvas();
            }
        });


        // --- Save and Load ---
        document.getElementById('saveData').addEventListener('click', saveData);
        document.getElementById('loadData').addEventListener('click', loadData);

        function saveData() {
            const json = JSON.stringify(classificationData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = 'cell_classification.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        function loadData() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const loaded = JSON.parse(e.target.result);
                        // Basic validation: check if it has a 'classes' property
                        if (!loaded || typeof loaded.classes !== 'object') {
                           throw new Error("Invalid classification file format.");
                        }
                        classificationData = loaded;

                        // Update class dropdown
                        const classSelect = document.getElementById('classSelect');
                        // Clear existing class options (keep "Unclassified")
                        while (classSelect.options.length > 1) {
                            classSelect.remove(1);
                        }

                        Object.keys(classificationData.classes).forEach(className => {
                            const classInfo = classificationData.classes[className];
                             // Add only if classInfo seems valid (has color)
                             if (classInfo && classInfo.color) {
                                const option = document.createElement('option');
                                option.value = className;
                                option.textContent = className;
                                option.style.backgroundColor = classInfo.color;

                                const hex = classInfo.color.slice(1);
                                const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.substr(i, 2), 16));
                                const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
                                option.style.color = luminance < 128 ? 'white' : 'black';

                                classSelect.appendChild(option);
                            } else {
                                console.warn(`Skipping invalid class data for "${className}" during load.`);
                            }
                        });

                        redrawCanvas();
                        updateClassCounters(); //update the counters
                        alert('Classification data loaded successfully');
                    } catch (error) {
                        console.error('Error parsing JSON or invalid format:', error);
                        alert('Error loading classification data: ' + error.message);
                        // Optionally reset classificationData to default if load fails
                        // classificationData = { classes: {} };
                        // updateClassCounters();
                        // redrawCanvas();
                    }
                };
                reader.onerror = () => {
                    alert('Error reading the classification file.');
                };
                reader.readAsText(file);
            });

            input.click();
        }

        // --- File handling ---
        function handleImageFolder(event) {
            const files = Array.from(event.target.files);
            imageFiles = files.filter(f => /\.(tiff?|png|jpe?g|bmp)$/i.test(f.name));

            const dropdown = document.getElementById('imageDropdown');
            dropdown.innerHTML = '<option value="">Select an image</option>';
            imageFiles.sort((a, b) => a.name.localeCompare(b.name)).forEach(file => { // Sort alphabetically
                const option = document.createElement('option');
                option.value = file.webkitRelativePath;
                option.textContent = file.name;
                dropdown.appendChild(option);
            });
            dropdown.style.display = 'block';
            // Reset relevant state when folder changes
            backgroundImage = null;
            imageScaleInfo = null;
            redrawCanvas(); // Clear canvas
        }

        function handleImageSelection(event) {
            const selectedFile = event.target.value;
            if (!selectedFile) {
                backgroundImage = null; // Clear image if "Select an image" is chosen
                redrawCanvas();
                return;
            }

            currentImageFile = imageFiles.find(f => f.webkitRelativePath === selectedFile);
            if (currentImageFile) loadImageFile(currentImageFile);
        }

        function handleCSVFolder(event) {
            const files = Array.from(event.target.files);
            csvFiles = files.filter(f => /\.csv$/i.test(f.name));

            const dropdown = document.getElementById('csvDropdown');
            dropdown.innerHTML = '<option value="">Select a CSV file</option>';
            csvFiles.sort((a, b) => a.name.localeCompare(b.name)).forEach(file => { // Sort alphabetically
                const option = document.createElement('option');
                option.value = file.webkitRelativePath;
                option.textContent = file.name;
                dropdown.appendChild(option);
            });
            dropdown.style.display = 'block';
            // Reset relevant state when folder changes
            data = null;
            currentCsvFile = null;
            updateClassCounters(); // Reset counters
            redrawCanvas(); // Redraw (will show only image if loaded)
        }

        function handleCSVSelection(event) {
            const selectedFile = event.target.value;
             if (!selectedFile) {
                data = null; // Clear data if "Select a CSV" is chosen
                currentCsvFile = null;
                updateClassCounters();
                redrawCanvas();
                return;
            }

            currentCsvFile = csvFiles.find(f => f.webkitRelativePath === selectedFile);
            if (currentCsvFile) loadCSVFile(currentCsvFile);
        }

        async function loadImageFile(file) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            let bitmap;

            if (/\.tiff?$/i.test(file.name)) {
              const uint8Array = new Uint8Array(arrayBuffer);
              const ifds = UTIF.decode(uint8Array);
               if (!ifds || ifds.length === 0) {
                   throw new Error("Could not decode TIFF file. No IFDs found.");
               }
              const page = ifds[0];  // Just get the first page
              UTIF.decodeImage(uint8Array, page);
              const rgba = UTIF.toRGBA8(page);

              // Create ImageData directly from the RGBA data
              const imageData = new ImageData(new Uint8ClampedArray(rgba), page.width, page.height);
              bitmap = await createImageBitmap(imageData);
            } else {
                bitmap = await createImageBitmap(new Blob([arrayBuffer], { type: file.type }));
            }
            backgroundImage = bitmap;
            imageScaleInfo = {
                scale: 1,
                offsetX: 0,
                offsetY: 0,
                imgWidth: bitmap.width,
                imgHeight: bitmap.height,
            };

            const canvas = document.getElementById('canvas');
            // Set initial canvas dimensions based on image
            canvas.width = bitmap.width * zoomFactor; // Apply initial zoom
            canvas.height = bitmap.height * zoomFactor; // Apply initial zoom
            canvas.style.width = `${canvas.width}px`;
            canvas.style.height = `${canvas.height}px`;


            const container = document.getElementById('scrollContainer');
            // Center canvas after setting dimensions
            container.scrollLeft = (canvas.width - container.clientWidth) / 2;
            container.scrollTop = (canvas.height - container.clientHeight) / 2;

            redrawCanvas(); // Initial draw

          } catch (error) {
            console.error('Image processing error:', error);
            alert('Error processing image file: ' + error.message);
            backgroundImage = null; // Reset on error
            imageScaleInfo = null;
            redrawCanvas(); // Clear canvas on error
          }
        }


        function loadCSVFile(file) {
            Papa.parse(file, {
                header: true,
                dynamicTyping: false, // Read all as strings initially for safety
                skipEmptyLines: true,
                complete: function(results) {
                    if (results.errors.length > 0) {
                         console.error('CSV parsing errors:', results.errors);
                         alert(`Error parsing CSV file: ${results.errors[0].message}. Please check the file format.`);
                         data = null; // Reset data on error
                         currentCsvFile = null; // Reset current file
                         updateClassCounters();
                         redrawCanvas();
                         return;
                    }
                    if (!results.data || results.data.length === 0) {
                        alert('CSV file is empty or contains no data rows.');
                        data = null;
                        currentCsvFile = null;
                        updateClassCounters();
                        redrawCanvas();
                        return;
                    }

                    const headers = results.meta.fields;
                    // Basic check for required columns (case-insensitive)
                     const requiredCols = ['X', 'Y', 'Major', 'Minor'];
                     const lowerCaseHeaders = headers.map(h => h.toLowerCase());
                     const missingCols = requiredCols.filter(col => !lowerCaseHeaders.includes(col.toLowerCase()));

                     if (missingCols.length > 0) {
                         alert(`CSV file is missing required columns: ${missingCols.join(', ')}`);
                         data = null;
                         currentCsvFile = null;
                         updateClassCounters();
                         redrawCanvas();
                         return;
                     }

                     // Filter and structure data (keep original headers)
                    data = [headers, ...results.data.filter(row => {
                        // Ensure the first column exists and starts with 'Nucleus_' (case-insensitive)
                        const firstColVal = row[headers[0]];
                        return typeof firstColVal === 'string' && firstColVal.toLowerCase().startsWith('nucleus_');
                    }).map(row => headers.map(header => row[header]))]; // Keep original header case

                    if (data.length <= 1) { // Only header row left
                         alert('No rows starting with "Nucleus_" found in the CSV file.');
                         data = null;
                         currentCsvFile = null;
                    }

                    redrawCanvas();
                    updateClassCounters(); //update after loading a CSV

                },
                error: function(error) {
                    console.error('CSV parsing PapaParse error:', error);
                    alert('Fatal error parsing CSV file: ' + error.message);
                    data = null;
                    currentCsvFile = null;
                    updateClassCounters();
                    redrawCanvas();
                }
            });
        }

       function getParticleColor(particleId) {
            if (!currentCsvFile || !classificationData || !classificationData.classes) return '#3d3d3d'; // Added checks

            const filename = currentCsvFile.name;
            const numericId = String(particleId).replace(/^Nucleus_/i, '');

            for (const className in classificationData.classes) {
                 // Check ownership and existence of properties
                 if (classificationData.classes.hasOwnProperty(className)) {
                    const classInfo = classificationData.classes[className];
                     // Use optional chaining for safer access
                    if (classInfo?.particles?.[filename]?.includes(numericId)) {
                        return classInfo.color;
                    }
                 }
            }
            return '#3d3d3d';
        }


         function getRGBAFromColor(color, opacity) {
            // Clamp opacity between 0 and 1
            const clampedOpacity = Math.max(0, Math.min(1, opacity));

            if (!color) return `rgba(128, 128, 128, ${clampedOpacity})`;

            try {
                let r, g, b;
                if (color.startsWith('#') && (color.length === 7 || color.length === 4)) { // Handles #RGB and #RRGGBB
                   let hex = color.slice(1);
                    if (hex.length === 3) {
                       hex = hex.split('').map(char => char + char).join(''); // Expand #RGB to #RRGGBB
                    }
                    [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
                } else if (color.startsWith('rgb(')) {
                    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                     if (match) {
                       [r, g, b] = match.slice(1, 4).map(Number);
                    } else {
                         throw new Error("Invalid RGB format"); // Or return default
                    }
                } else {
                     // Could add support for color names here if needed, otherwise default
                     return `rgba(128, 128, 128, ${clampedOpacity})`;
                }
                 // Ensure r, g, b are valid numbers before creating the string
                if (isNaN(r) || isNaN(g) || isNaN(b)) {
                   return `rgba(128, 128, 128, ${clampedOpacity})`;
                }
                return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`;
            } catch (e) {
                console.warn("Could not parse color:", color, e); // Log warning
                return `rgba(128, 128, 128, ${clampedOpacity})`; // Return default grey on error
            }
        }


        function redrawCanvas() {
          const canvas = document.getElementById('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: false }); // Set willReadFrequently based on actual usage
          const container = document.getElementById('scrollContainer');

           // Ensure canvas dimensions are updated based on zoom *before* clearing/drawing
           // Use image dimensions if available, otherwise keep current canvas size
            const baseWidth = imageScaleInfo ? imageScaleInfo.imgWidth : canvas.width / zoomFactor;
            const baseHeight = imageScaleInfo ? imageScaleInfo.imgHeight : canvas.height / zoomFactor;

            // Prevent excessively large canvas dimensions if zoom is very high or image is huge
            const maxWidth = 16384; // Common canvas size limit, adjust if needed
            const maxHeight = 16384;
            const targetWidth = Math.min(baseWidth * zoomFactor, maxWidth);
            const targetHeight = Math.min(baseHeight * zoomFactor, maxHeight);

            // Only resize if necessary to avoid flicker/performance issues
            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                canvas.width = targetWidth;
                canvas.height = targetHeight;
            }
             canvas.style.width = `${canvas.width}px`;
             canvas.style.height = `${canvas.height}px`;

          // Clear the entire canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // --- Draw Background Image (if loaded) ---
          if (backgroundImage && imageScaleInfo) {
             const { scale, imgWidth, imgHeight } = imageScaleInfo; // Scale is currently always 1, but kept for potential future use
             const { offsetX, offsetY } = imageScaleInfo; // Offset is currently 0

             // Draw the image filling the zoomed canvas space
             // The source image is the whole image, the destination is the whole canvas
              ctx.drawImage(backgroundImage,
                    0, 0, imgWidth, imgHeight, // Source rectangle (full original image)
                    offsetX * zoomFactor, offsetY * zoomFactor, canvas.width, canvas.height // Destination rectangle (full zoomed canvas)
                );

            } else {
                // Optional: Fill with a background color if no image is loaded
                ctx.fillStyle = '#f0f0f0'; // Match canvas background color in CSS
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }


          // --- Optimized Particle Drawing ---
          if (data && imageScaleInfo && data.length > 1) { // Check data has rows
            const { scale, offsetX, offsetY } = imageScaleInfo;
            const headers = data[0];
            const globalScale = parseFloat(document.getElementById('globalScale').value) || 1;
            const invGlobalScale = 1.0 / globalScale;
            // Combined scale factor including zoom
            const scaleFactor = invGlobalScale * scale * zoomFactor;

            // Calculate viewport boundaries in *canvas coordinates*
            const viewLeft = container.scrollLeft;
            const viewTop = container.scrollTop;
            const viewRight = viewLeft + container.clientWidth;
            const viewBottom = viewTop + container.clientHeight;

            // Add a small margin for drawing elements slightly outside the viewport
            // This helps prevent clipping at the edges during panning/zooming.
            const margin = 50 * zoomFactor; // Margin in canvas pixels, scales with zoom

            // Use a standard for loop for performance.
            for (let i = 1; i < data.length; i++) { // Start at 1 to skip header row
                const row = data[i];
                // Create object only if needed or cache header indices? For now, create per row.
                 // Safer property access: Use || 0 for defaults
                const n = Object.fromEntries(headers.map((header, j) => [header, row[j]]));
                const xValue = parseFloat(n.X || 0);
                const yValue = parseFloat(n.Y || 0);
                const majorValue = parseFloat(n.Major || 0);
                const minorValue = parseFloat(n.Minor || 0);
                const angleValue = parseFloat(n.Angle || 0);

                // Skip if essential values are invalid or zero (can't draw ellipse)
                if (isNaN(xValue) || isNaN(yValue) || !majorValue || !minorValue) continue;

                 // Calculate ellipse parameters in *canvas coordinates*
                const major = majorValue * scaleFactor;
                const minor = minorValue * scaleFactor;
                const angle = -(angleValue * Math.PI) / 180.0; // Convert degrees to radians, negate for canvas rotation
                const x = xValue * scaleFactor + offsetX * zoomFactor;
                const y = yValue * scaleFactor + offsetY * zoomFactor;


                const particleId = row[0]; // Assuming first column is ID
                const particleColor = getParticleColor(particleId);

                // Viewport Culling: Check if the ellipse's bounding box intersects the visible area + margin
                 // Approximate bounding box check (simpler than rotated bounding box)
                const halfMajor = major / 2.0;
                const halfMinor = minor / 2.0;
                const maxRadius = Math.sqrt(halfMajor*halfMajor + halfMinor*halfMinor); // Use max extent for culling check

                 if (x + maxRadius >= viewLeft - margin &&
                    x - maxRadius <= viewRight + margin &&
                    y + maxRadius >= viewTop - margin &&
                    y - maxRadius <= viewBottom + margin)
                {
                    ctx.save();
                    ctx.strokeStyle = particleColor;
                     // Apply fill only if opacity > 0
                    if (fillOpacity > 0) {
                         ctx.fillStyle = getRGBAFromColor(particleColor, fillOpacity);
                    }
                    // Apply stroke only if border width > 0
                    ctx.lineWidth = borderWidth > 0 ? borderWidth : 0;

                    ctx.translate(x, y);
                    ctx.rotate(angle);
                    ctx.beginPath();
                    // Ellipse path centered at (0,0) after translation/rotation
                    ctx.ellipse(0, 0, halfMajor, halfMinor, 0, 0, 2 * Math.PI);

                    if (fillOpacity > 0) {
                         ctx.fill();
                    }
                     if (borderWidth > 0) {
                         ctx.stroke();
                    }
                    ctx.restore();
                }
            }
          }
        }

        // Initial setup
        updateZoomDisplay();
        updateClassCounters(); // Show initial counters (likely 0)
        redrawCanvas(); // Initial draw (will be blank or grey until image loaded)

    </script>

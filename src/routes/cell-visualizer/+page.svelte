<svelte:head>
  <title>Cell Visualizer</title>
  <meta name="description" content="Cell Visualizer Page" />
</svelte:head>

<div class="container mx-auto py-8">
  <h1 class="text-3xl font-bold mb-2 text-center">Cell Visualization Tool</h1>

  <div class="controls">
    <div class="control-group">
      <h3>Input Files</h3>
      <div>
        <label class="file-input-label" for="imageFolderInput">Choose Image Folder</label>
        <input type="file" id="imageFolderInput" webkitdirectory directory multiple>
        <span id="imageFolderName" style="margin-left: 10px; font-style: italic;"></span>
      </div>
      <select id="imageDropdown" style="display: none;"></select>

      <div>
        <label class="file-input-label" for="csvFileInput">Choose Cell Data File (.csv)</label>
        <input type="file" id="csvFileInput" accept=".csv">
        <span id="csvFileName" style="margin-left: 10px; font-style: italic;"></span>
      </div>
      <div class="filter-group">
        <label for="filterDropdown">Filter by Original File:</label>
        <select id="filterDropdown" style="display: none;"></select>
      </div>
    </div>

    <div class="control-group">
      <h3>Display Settings</h3>
      <div class="settings-group">
        <div class="setting-row">
          <label for="globalScale">Scale (px/unit):</label>
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

  <div class="class-color-controls">
    <h3>Class Colors (Fallback for Predicted_Class_Index)</h3>
    <div class="color-control-group">
      <label for="class0Color">Index 0:</label>
      <input type="color" id="class0Color" value="#ff0000">
      <span class="color-preview" id="class0Preview"></span>
    </div>
    <div class="color-control-group">
      <label for="class1Color">Index 1:</label>
      <input type="color" id="class1Color" value="#00ff00">
      <span class="color-preview" id="class1Preview"></span>
    </div>
    <div class="color-control-group">
      <label for="class2Color">Index 2:</label>
      <input type="color" id="class2Color" value="#0000ff">
      <span class="color-preview" id="class2Preview"></span>
    </div>
    <div class="color-control-group">
      <label for="class3Color">Index 3:</label>
      <input type="color" id="class3Color" value="#ffff00">
      <span class="color-preview" id="class3Preview"></span>
    </div>
    <div class="color-control-group">
      <label for="unclassifiedColor">Other/NA:</label>
      <input type="color" id="unclassifiedColor" value="#808080">
      <span class="color-preview" id="unclassifiedPreview"></span>
    </div>
  </div>

  <div class="counters-container" id="countersContainer">
    <!-- Class counters will be added here -->
  </div>

  <div class="canvas-container" id="scrollContainer">
    <canvas id="canvas"></canvas>
  </div>
</div>

<style>
body {
font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
margin: 0;
padding: 0;
background-color: #f8f9fa;
color: #343a40;
}

.container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
    }

    .controls, .class-color-controls {
        background-color: white;
        border-radius: 10px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        padding: 20px;
        margin-bottom: 20px;
        width: 90%;
        max-width: 1200px;
    }

    .controls {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
    }

     .class-color-controls {
        display: grid;
        /* Adjust grid columns for color pickers + labels */
         grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        align-items: center;
        margin: 20px 0;
    }

    .color-control-group {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .control-group {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .canvas-container {
        width: 90vw;
        height: 70vh;
        overflow: auto;
        border: 2px solid #ced4da;
        border-radius: 10px;
        background: white;
        position: relative;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    canvas {
        display: block;
        background-color: #f0f0f0;
        /* Ensure canvas starts without explicit large dimensions set in style */
    }

    /* Consistent Input Styles */
    button, select, input[type="number"], input[type="text"], input[type="color"] {
        padding: 10px 15px;
        border-radius: 8px;
        border: 1px solid #ced4da;
        font-size: 16px;
        transition: all 0.3s ease;
        background-color: white;
    }

     input[type="color"] {
        width: 40px; /* Smaller color picker */
        height: 40px;
        padding: 2px; /* Adjust padding for color picker */
        vertical-align: middle;
     }

    button {
        background-color: #007bff;
        color: white;
        border: none;
        cursor: pointer;
        font-weight: 500;
    }

    button:hover, button:focus {
        background-color: #0056b3;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        outline: none;
    }
    input:focus, select:focus {
        border-color: #007bff;
        box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
        outline: none;
    }

    .file-input-label {
        padding: 10px 15px;
        background-color: #28a745;
        color: white;
        border-radius: 8px;
        cursor: pointer;
        display: inline-block;
        font-weight: 500;
        transition: background-color 0.3s ease;
    }

    .file-input-label:hover {
        background-color: #218838;
    }

    input[type="file"] {
        display: none;
    }

    select {
        min-width: 180px;
    }
    h1, h3 {
        color: #0056b3;
        margin-bottom: 1rem;
    }
    h1{
        text-align: center;
    }

    .zoom-controls {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .counters-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
      margin-top: 20px;
    }

    .class-counter {
        padding: 5px 10px;
        border-radius: 5px;
        font-size: 0.8em;
        font-weight: bold;
        color: white; /* Default text color, adjust below */
    }

    .settings-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .setting-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .color-preview {
        width: 20px;
        height: 20px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        display: inline-block;
        vertical-align: middle;
    }

    /* Style for the filter dropdown group */
    .filter-group {
        display: flex;
        flex-direction: column;
        gap: 5px; /* Space between label and dropdown */
        margin-top: 10px; /* Space above the filter */
    }
</style>

<script>
    // Global variables
    let backgroundImage = null;
    let imageScaleInfo = null; // Stores { scale, offsetX, offsetY, imgWidth, imgHeight }
    let data = null; // Holds FULL parsed CSV data [headers, [row1], [row2], ...]
    let imageFiles = []; // Holds list of selected image files
    let currentImageFile = null; // The currently selected File object for image
    let currentFilterValue = null; // The currently selected value from Original_File dropdown
    let originalFileColIndex = -1; // Index of the 'Original_File' column in CSV
    let zoomFactor = 1;
    let borderWidth = 2;
    let fillOpacity = 0.2;
    // UI colors map - used as FALLBACK if CSV color is missing/invalid
    let classColors = {
        '0': '#ff0000',
        '1': '#00ff00',
        '2': '#0000ff',
        '3': '#ffff00',
        'unclassified': '#808080' // Color for indices not in map or invalid CSV color
    };
     // Store mapping from Predicted_Class_Index to Predicted_Class_Name
    let classNameMap = {};


    // --- Event listeners ---
    document.getElementById('imageFolderInput').addEventListener('change', handleImageFolder);
    document.getElementById('imageDropdown').addEventListener('change', handleImageSelection);
    document.getElementById('csvFileInput').addEventListener('change', handleCSVFile);
    document.getElementById('filterDropdown').addEventListener('change', handleFilterSelection);

    document.getElementById('globalScale').addEventListener('input', redrawCanvas);
    document.getElementById('borderWidth').addEventListener('input', handleStyleChange);
    document.getElementById('fillOpacity').addEventListener('input', handleStyleChange);

    // Color picker listeners (update the fallback map)
    document.getElementById('class0Color').addEventListener('input', (e) => updateClassColor('0', e.target.value));
    document.getElementById('class1Color').addEventListener('input', (e) => updateClassColor('1', e.target.value));
    document.getElementById('class2Color').addEventListener('input', (e) => updateClassColor('2', e.target.value));
    document.getElementById('class3Color').addEventListener('input', (e) => updateClassColor('3', e.target.value));
    document.getElementById('unclassifiedColor').addEventListener('input', (e) => updateClassColor('unclassified', e.target.value));

    function initializeColorPreviews() {
         updateColorPreview('0', classColors['0']);
         updateColorPreview('1', classColors['1']);
         updateColorPreview('2', classColors['2']);
         updateColorPreview('3', classColors['3']);
         updateColorPreview('unclassified', classColors['unclassified']);
    }
    initializeColorPreviews();

    function updateClassColor(classIndex, color) {
        classColors[classIndex] = color; // Update the fallback map
        updateColorPreview(classIndex, color);
        redrawCanvas(); // Redraw might change particle colors if they were using fallback
        updateClassCounters(); // Update counter colors/labels if needed
    }

     function updateColorPreview(classIndex, color) {
         const previewId = `class${classIndex}Preview`;
         const previewElement = document.getElementById(previewId);
         if (previewElement) {
             previewElement.style.backgroundColor = color;
         }
     }

    // --- Zoom controls ---
    document.getElementById('zoomIn').addEventListener('click', () => {
        zoomFactor *= 1.2; updateZoomDisplay(); redrawCanvas();
    });
    document.getElementById('zoomOut').addEventListener('click', () => {
        zoomFactor /= 1.2; if (zoomFactor < 0.1) zoomFactor = 0.1; updateZoomDisplay(); redrawCanvas();
    });
    document.getElementById('resetZoom').addEventListener('click', () => {
        zoomFactor = 1; updateZoomDisplay();
        if (backgroundImage && imageScaleInfo) { // Recenter
             const canvas = document.getElementById('canvas'); const container = document.getElementById('scrollContainer');
             canvas.width = imageScaleInfo.imgWidth * imageScaleInfo.scale * zoomFactor;
             canvas.height = imageScaleInfo.imgHeight * imageScaleInfo.scale * zoomFactor;
             canvas.style.width = `${canvas.width}px`; canvas.style.height = `${canvas.height}px`;
             container.scrollTo({ left: (canvas.width - container.clientWidth) / 2, top: (canvas.height - container.clientHeight) / 2, behavior: 'smooth' });
         }
        redrawCanvas();
    });

    function updateZoomDisplay() { document.getElementById('zoomLevel').textContent = `${Math.round(zoomFactor * 100)}%`; }
    function handleStyleChange() {
        borderWidth = parseFloat(document.getElementById('borderWidth').value) || 2;
        fillOpacity = parseFloat(document.getElementById('fillOpacity').value) || 0.2;
        redrawCanvas();
    }
    const scrollContainer = document.getElementById('scrollContainer');
    scrollContainer.addEventListener('scroll', redrawCanvas);

    // Update class counters based on loaded CSV data AND current filter
    function updateClassCounters() {
        const countersContainer = document.getElementById('countersContainer');
        countersContainer.innerHTML = '';

        if (!data || data.length < 2 || !currentFilterValue) {
             countersContainer.textContent = 'Load CSV data and select a file filter to see counts.';
             return;
        }

        const counts = {}; // Keyed by Predicted_Class_Index
        const headers = data[0];
        const predictedIndexCol = headers.indexOf('Predicted_Class_Index');
        const predictedNameCol = headers.indexOf('Predicted_Class_Name'); // Get name column index

        if (predictedIndexCol === -1 || originalFileColIndex === -1) {
            // ... (error handling for missing columns) ...
             const missing = [];
             if (predictedIndexCol === -1) missing.push('"Predicted_Class_Index"');
             if (originalFileColIndex === -1) missing.push('"Original_File"');
             countersContainer.textContent = `CSV missing required column(s): ${missing.join(' and ')}.`;
             return;
        }

        // Initialize counts for known classes (from UI map) and unclassified
        Object.keys(classColors).forEach(key => { counts[key] = 0; });

        // Build/Update classNameMap and count occurrences
        classNameMap = {}; // Reset map
        for (let i = 1; i < data.length; i++) {
             const row = data[i];
             if (row[originalFileColIndex] !== currentFilterValue) continue; // Filter check

             const predictedIndexRaw = row[predictedIndexCol];
             const indexStr = String(predictedIndexRaw); // Use string for key
             const predictedName = (predictedNameCol !== -1 && row[predictedNameCol]) ? row[predictedNameCol] : `Index ${indexStr}`; // Fallback name

             // Update map (only need one entry per index)
             if (!classNameMap[indexStr] && indexStr !== 'unclassified') {
                 classNameMap[indexStr] = predictedName;
             }

             // Count
             if (predictedIndexRaw !== null && predictedIndexRaw !== undefined && classColors.hasOwnProperty(indexStr)) {
                 counts[indexStr]++;
             } else {
                 counts['unclassified']++;
             }
        }

        // Create counter display elements
        let totalCount = 0;
        for (const classIndex in counts) {
            const count = counts[classIndex];
            if (count === 0 && !classColors.hasOwnProperty(classIndex)) continue; // Skip unused, undefined indices

            totalCount += count;
            const color = classColors[classIndex]; // Use UI map color for counter background
            const counterDiv = document.createElement('div');
            counterDiv.classList.add('class-counter');
            counterDiv.style.backgroundColor = color || classColors['unclassified']; // Fallback color

            // Set text color based on background brightness
             const hex = (color && color.startsWith('#')) ? color.slice(1) : '808080';
             let r = 0, g = 0, b = 0;
             if (hex.length === 6) { [r, g, b] = [0, 2, 4].map(i => parseInt(hex.substr(i, 2), 16)); }
             else if (hex.length === 3) { [r, g, b] = [0, 1, 2].map(i => parseInt(hex.substr(i, 1) + hex.substr(i, 1), 16)); }
             const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
             counterDiv.style.color = luminance < 128 ? 'white' : 'black';

            // Use name from map, or default label
            let label = `Index ${classIndex}`; // Default
            if (classIndex === 'unclassified') {
                label = 'Other/NA';
            } else if (classNameMap[classIndex]) {
                label = classNameMap[classIndex];
            }

            counterDiv.textContent = `${label}: ${count}`;
            countersContainer.appendChild(counterDiv);
        }

         if (totalCount === 0) {
             countersContainer.textContent = `No cells found for filter "${currentFilterValue}".`;
         }
    }

    // --- File handling --- (Largely unchanged, only CSV loading needs adjustment)
    function handleImageFolder(event) {
        const files = Array.from(event.target.files);
        imageFiles = files.filter(f => /\.(tiff?|png|jpe?g|bmp)$/i.test(f.name));
        const dropdown = document.getElementById('imageDropdown');
        dropdown.innerHTML = '<option value="">Select an image</option>';
        imageFiles.sort((a, b) => a.name.localeCompare(b.name)).forEach(file => {
            const option = document.createElement('option');
            option.value = file.webkitRelativePath; option.textContent = file.name; dropdown.appendChild(option);
        });
        dropdown.style.display = imageFiles.length > 0 ? 'block' : 'none';
        document.getElementById('imageFolderName').textContent = files.length > 0 ? `${files.length} file(s) selected` : '';
        backgroundImage = null; imageScaleInfo = null; currentImageFile = null;
        document.getElementById('canvas').getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        if(data && currentFilterValue) { matchFilesAndLoad(); } else { redrawCanvas(); }
    }

    function handleImageSelection(event) {
        const selectedPath = event.target.value;
        if (!selectedPath) { backgroundImage = null; imageScaleInfo = null; currentImageFile = null; redrawCanvas(); return; }
        currentImageFile = imageFiles.find(f => f.webkitRelativePath === selectedPath);
        if (currentImageFile) { loadImageFile(currentImageFile); matchFilesAndLoad(); }
        else { console.error("Selected image file not found:", selectedPath); backgroundImage = null; imageScaleInfo = null; redrawCanvas(); }
    }

    function handleCSVFile(event) {
        const file = event.target.files[0];
        const filterDropdown = document.getElementById('filterDropdown');
        const csvFileNameSpan = document.getElementById('csvFileName');
        if (!file) {
            data = null; originalFileColIndex = -1; currentFilterValue = null; classNameMap = {};
            filterDropdown.innerHTML = ''; filterDropdown.style.display = 'none'; csvFileNameSpan.textContent = '';
            redrawCanvas(); updateClassCounters(); return;
        }
        if (!/\.csv$/i.test(file.name)) { alert("Please select a valid .csv file."); event.target.value = ''; csvFileNameSpan.textContent = ''; return; }
        csvFileNameSpan.textContent = file.name;
        loadCSVFile(file); // loadCSVFile handles parsing and dropdown population
    }

    function handleFilterSelection(event) {
        currentFilterValue = event.target.value;
        console.log("Filter selected:", currentFilterValue);
        if (!currentFilterValue) { /* Handle deselection if needed */ }
        matchFilesAndLoad(); // Try to load matching image
        updateClassCounters(); // Update counts for the new filter
        redrawCanvas();      // Redraw particles for the new filter
    }

    function matchFilesAndLoad() { // Logic remains the same
         const imageDropdown = document.getElementById('imageDropdown');
         const filterDropdown = document.getElementById('filterDropdown');
         if (currentFilterValue && !currentImageFile && imageFiles.length > 0) {
            const matchedImage = imageFiles.find(img => img.name.startsWith(currentFilterValue));
            if (matchedImage) {
                 console.log(`Auto-matched Filter "${currentFilterValue}" to Image "${matchedImage.name}"`);
                 imageDropdown.value = matchedImage.webkitRelativePath;
                 handleImageSelection({ target: { value: matchedImage.webkitRelativePath } });
                 return;
            } else { console.log(`No image found starting with filter "${currentFilterValue}"`); }
         } else if (currentImageFile && data && !currentFilterValue) {
             const imageBaseName = currentImageFile.name;
             let matchedFilter = null;
             for (let i = 0; i < filterDropdown.options.length; i++) {
                 const optionValue = filterDropdown.options[i].value;
                 if (optionValue && imageBaseName.startsWith(optionValue)) { matchedFilter = optionValue; break; }
             }
             if (matchedFilter) {
                 console.log(`Auto-matched Image "${imageBaseName}" to Filter "${matchedFilter}"`);
                 filterDropdown.value = matchedFilter;
                 handleFilterSelection({ target: { value: matchedFilter } });
                 return;
             } else { console.log(`No filter value found matching image "${imageBaseName}"`); }
         }
         updateClassCounters(); // Ensure updates if no match triggered changes
         redrawCanvas();
    }

    async function loadImageFile(file) { // Logic remains the same
      console.log("Loading image:", file.name);
      try {
        const arrayBuffer = await file.arrayBuffer(); let bitmap;
        if (/\.tiff?$/i.test(file.name)) {
            const uint8Array = new Uint8Array(arrayBuffer); const ifds = UTIF.decode(uint8Array);
            if (!ifds || ifds.length === 0) throw new Error("Could not decode TIFF IFDs.");
            const page = ifds[0]; UTIF.decodeImage(uint8Array, page); const rgba = UTIF.toRGBA8(page);
            console.log(`TIFF Decoded: ${page.width}x${page.height}`);
            const imageData = new ImageData(new Uint8ClampedArray(rgba), page.width, page.height);
            bitmap = await createImageBitmap(imageData);
        } else {
            bitmap = await createImageBitmap(new Blob([arrayBuffer], { type: file.type }));
             console.log(`Image Decoded: ${bitmap.width}x${bitmap.height}`);
        }
        backgroundImage = bitmap;
        imageScaleInfo = { scale: 1, offsetX: 0, offsetY: 0, imgWidth: bitmap.width, imgHeight: bitmap.height };
        const canvas = document.getElementById('canvas');
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        canvas.style.width = `${bitmap.width}px`; canvas.style.height = `${bitmap.height}px`;
        zoomFactor = 1; updateZoomDisplay();
        const container = document.getElementById('scrollContainer');
        container.scrollTo({ left: (canvas.width - container.clientWidth) / 2, top: (canvas.height - container.clientHeight) / 2 });
        redrawCanvas();
      } catch (error) { /* ... error handling ... */
          console.error('Image processing error:', error); alert(`Error processing image file: ${error.message}`);
          backgroundImage = null; imageScaleInfo = null; currentImageFile = null;
          document.getElementById('imageDropdown').value = ""; redrawCanvas();
       }
    }

    function loadCSVFile(file) { // Adapted for new format requirements
         console.log("Loading CSV:", file.name);
         const filterDropdown = document.getElementById('filterDropdown');
         classNameMap = {}; // Reset name map on new file load
        Papa.parse(file, {
            header: false, // Read header manually
            delimiter: ";",
            dynamicTyping: false, // Parse numbers manually with parseFloatSafe
            skipEmptyLines: true,
            complete: function(results) {
                if (!results.data || results.data.length < 2) { /*... error handling ...*/ return; }
                const headers = results.data[0];
                const rows = results.data.slice(1);
                console.log("CSV Parsed. Headers:", headers);

                originalFileColIndex = headers.indexOf('Original_File');
                if (originalFileColIndex === -1) { /*... error handling ...*/ return; }

                data = [headers, ...rows]; // Store full data
                console.log(`Found ${rows.length} data rows.`);

                // Populate filter dropdown
                const uniqueFiles = [...new Set(rows.map(row => row[originalFileColIndex]))].filter(Boolean).sort((a, b) => a.localeCompare(b));
                filterDropdown.innerHTML = '<option value="">Select File Filter</option>';
                uniqueFiles.forEach(fileName => { /* ... add options ... */
                     const option = document.createElement('option'); option.value = fileName; option.textContent = fileName; filterDropdown.appendChild(option);
                 });
                filterDropdown.style.display = uniqueFiles.length > 0 ? 'block' : 'none';
                currentFilterValue = null; // Reset filter selection
                if (uniqueFiles.length === 0) { alert("No unique file identifiers found in 'Original_File' column."); }

                // Check required drawing/coloring columns
                 const requiredCols = ['Nucleus_X', 'Nucleus_Y', 'Nucleus_Major', 'Nucleus_Minor', 'Predicted_Class_Color', 'Predicted_Class_Index'];
                 const missingCols = requiredCols.filter(col => !headers.includes(col));
                 if (missingCols.length > 0) {
                     alert(`CSV might be missing columns needed for drawing/coloring: ${missingCols.join(', ')}`);
                 }

                matchFilesAndLoad(); // Trigger matching/redraw
            },
            error: function(error) { /*... error handling ...*/
                 console.error('CSV parsing error:', error); alert(`Error parsing CSV file: ${error.message}`);
                 data = null; originalFileColIndex = -1; currentFilterValue = null; classNameMap = {};
                 filterDropdown.innerHTML = ''; filterDropdown.style.display = 'none';
                 updateClassCounters(); redrawCanvas();
            }
        });
    }

    // *** MODIFIED: This function gets color FOR DRAWING ***
    // Priority: 1. CSV Color Column, 2. UI Map using Index Column, 3. Unclassified Color
    function getParticleDrawColor(particleRowData, headers) {
        if (!particleRowData || !headers) return classColors['unclassified'];

        const colorCol = headers.indexOf('Predicted_Class_Color');
        const indexCol = headers.indexOf('Predicted_Class_Index');

        // 1. Try CSV Color Column
        if (colorCol !== -1) {
            const csvColor = particleRowData[colorCol];
            if (csvColor && typeof csvColor === 'string' && csvColor.startsWith('#')) {
                // Basic validation: is it a non-empty string starting with #?
                // More robust validation could check hex format precisely.
                return csvColor;
            }
            // If CSV color is present but invalid, log it maybe?
            // console.warn(`Invalid color format in CSV: ${csvColor}`);
        }

        // 2. Fallback to UI Map using Index Column
        if (indexCol !== -1) {
             const predictedIndexRaw = particleRowData[indexCol];
             if (predictedIndexRaw !== null && predictedIndexRaw !== undefined && String(predictedIndexRaw).trim() !== '') {
                 const parsedIndex = parseFloatSafe(predictedIndexRaw);
                 const indexStr = !isNaN(parsedIndex) ? String(Math.round(parsedIndex)) : String(predictedIndexRaw);
                 if (classColors.hasOwnProperty(indexStr)) {
                     return classColors[indexStr]; // Use color from UI map
                 }
             }
        }

        // 3. Final fallback
        return classColors['unclassified'];
    }

    function getRGBAFromColor(color, opacity) { // Logic remains the same
        if (!color) return `rgba(128, 128, 128, ${opacity})`; // Default grey
         if (String(color).startsWith('rgba')) return color; // Already RGBA
         try {
             let r, g, b;
             if (color.startsWith('#')) {
                 let hex = color.slice(1);
                 if (hex.length === 3) { hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]; }
                 if (hex.length === 6) {
                     r = parseInt(hex.substring(0, 2), 16); g = parseInt(hex.substring(2, 4), 16); b = parseInt(hex.substring(4, 6), 16);
                 } else { throw new Error("Invalid hex format"); }
             } else { /* Optional: Handle 'rgb(...)' or named colors if needed, otherwise default grey */
                 console.warn(`Unsupported color format '${color}'. Using default.`);
                 return `rgba(128, 128, 128, ${opacity})`;
             }
             if (isNaN(r) || isNaN(g) || isNaN(b)) { throw new Error("Parsed color values not numbers"); }
             return `rgba(${r}, ${g}, ${b}, ${opacity})`;
         } catch (e) {
             console.warn(`Could not parse color '${color}': ${e.message}. Using default.`);
             return `rgba(128, 128, 128, ${opacity})`;
         }
     }

    function parseFloatSafe(value) { // Logic remains the same
        if (value === null || value === undefined) return NaN;
        const strValue = String(value);
        const cleanedStr = /^\s*-?\d+,?\d*\s*$/.test(strValue) ? strValue.replace(',', '.') : strValue; // Allow comma decimal
        return parseFloat(cleanedStr);
    }


    // *** MODIFIED redrawCanvas FUNCTION ***
    function redrawCanvas() {
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const container = document.getElementById('scrollContainer');

        // --- Clear Canvas ---
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- Exit/Message if no image ---
        if (!backgroundImage || !imageScaleInfo) {
            ctx.fillStyle = '#ccc'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
            const center_x = canvas.width > 0 ? canvas.width / 2 : 150;
            const center_y = canvas.height > 0 ? canvas.height / 2 : 100;
            ctx.fillText('Load an image folder', center_x, center_y);
            return;
        }

        // --- Get necessary values ---
        const globalScale = parseFloatSafe(document.getElementById('globalScale').value) || 1; // Use safe parse
        const { scale, imgWidth, imgHeight, offsetX, offsetY } = imageScaleInfo;

        // --- Canvas Sizing ---
        const effectiveWidth = imgWidth * scale * zoomFactor;
        const effectiveHeight = imgHeight * scale * zoomFactor;
        if (canvas.width !== effectiveWidth || canvas.height !== effectiveHeight) {
            canvas.width = effectiveWidth; canvas.height = effectiveHeight;
        }
        canvas.style.width = `${effectiveWidth}px`; canvas.style.height = `${effectiveHeight}px`;

        // --- Draw Background Image (Simplified) ---
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

        // --- Particle Drawing (Visualizer Logic) ---
        // Requires Data AND Filter AND essential columns
        if (data && data.length > 1 && imageScaleInfo && currentFilterValue && originalFileColIndex !== -1) {
            const headers = data[0];
            // Get required column indices once
            const xCol = headers.indexOf('Nucleus_X');
            const yCol = headers.indexOf('Nucleus_Y');
            const majorCol = headers.indexOf('Nucleus_Major');
            const minorCol = headers.indexOf('Nucleus_Minor');
            const angleCol = headers.indexOf('Nucleus_Angle');
            // Color columns needed for getParticleDrawColor are checked inside it

            if (xCol === -1 || yCol === -1 || majorCol === -1 || minorCol === -1) {
                console.warn("Missing essential columns (Nucleus_X/Y/Major/Minor) for particle drawing.");
                if (!ctx.warningDrawn) { // Draw warning only once per redraw
                     ctx.fillStyle = 'orange'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
                     ctx.fillText('Warning: Missing essential Nucleus columns in CSV!', canvas.width / 2, 30);
                     ctx.warningDrawn = true; // Mark warning as drawn
                }
            } else {
                 ctx.warningDrawn = false; // Reset warning flag if columns are present
                 const invGlobalScale = 1.0 / globalScale;
                 const scaleFactor = invGlobalScale * scale * zoomFactor; // Combined scaling

                 // Viewport Culling Bounds
                 const viewportLeft = container.scrollLeft; const viewportTop = container.scrollTop;
                 const viewportWidth = container.clientWidth; const viewportHeight = container.clientHeight;
                 const margin = 50 * zoomFactor; // Margin in zoomed pixels
                 const viewLeft = viewportLeft - margin; const viewTop = viewportTop - margin;
                 const viewRight = viewportLeft + viewportWidth + margin; const viewBottom = viewportTop + viewportHeight + margin;

                 let drawnCount = 0;

                 for (let i = 1; i < data.length; i++) {
                     const row = data[i];

                     // Apply Filter
                     if (row[originalFileColIndex] !== currentFilterValue) {
                         continue;
                     }

                     // Get values safely
                     const xValue = parseFloatSafe(row[xCol]);
                     const yValue = parseFloatSafe(row[yCol]);
                     const majorValue = parseFloatSafe(row[majorCol]);
                     const minorValue = parseFloatSafe(row[minorCol]);
                     const angleValue = (angleCol !== -1 && row[angleCol] !== null) ? parseFloatSafe(row[angleCol]) : 0;

                     if (isNaN(xValue) || isNaN(yValue) || isNaN(majorValue) || isNaN(minorValue)) continue;

                     const major = majorValue * scaleFactor;
                     const minor = minorValue * scaleFactor;
                     const angle = -(angleValue * Math.PI) / 180.0;
                     const x = (xValue * invGlobalScale * scale + offsetX) * zoomFactor;
                     const y = (yValue * invGlobalScale * scale + offsetY) * zoomFactor;

                     // Culling check
                     const maxRadius = Math.max(major, minor) / 2.0 * 1.1;
                     if (x + maxRadius < viewLeft || x - maxRadius > viewRight || y + maxRadius < viewTop || y - maxRadius > viewBottom) {
                         continue;
                     }
                     drawnCount++;

                     // Draw Ellipse
                     // *** Use getParticleDrawColor to get color from CSV or fallback ***
                     const particleColor = getParticleDrawColor(row, headers);

                     ctx.save();
                     ctx.strokeStyle = particleColor; // Use determined color
                     ctx.fillStyle = getRGBAFromColor(particleColor, fillOpacity); // Use determined color
                     ctx.lineWidth = borderWidth; // Use UI border width (not scaled by zoom)

                     if (major <= 0 || minor <= 0) { ctx.restore(); continue; } // Skip invalid shapes

                     ctx.translate(x, y);
                     ctx.rotate(angle);
                     ctx.beginPath();
                     ctx.ellipse(0, 0, major / 2.0, minor / 2.0, 0, 0, 2 * Math.PI);
                     ctx.fill();
                     ctx.stroke();
                     ctx.restore();
                 }
                 // console.log(`Drawn ${drawnCount} particles for filter "${currentFilterValue}".`);
            }
        } else if (data && data.length > 1 && !currentFilterValue) {
             // Message if data loaded but no filter selected
             ctx.fillStyle = '#aaa'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
             if (backgroundImage) { // Show only if image is also loaded
                 ctx.fillText('Select a file filter to view cells', canvas.width / 2, canvas.height / 2 + 30);
             }
        }
        // console.log("redrawCanvas finished.");
    }

</script>


<script lang="ts">
  import { onMount } from 'svelte';
  // Import UTIF using dynamic import to avoid SSR issues
  import Papa from 'papaparse';

  // Global variables
  let backgroundImage: ImageBitmap | null = null;
  let imageScaleInfo: { scale: number; offsetX: number; offsetY: number; imgWidth: number; imgHeight: number } | null = null;
  let data: any[] | null = null;
  let classificationData: {
    classes: {
      [className: string]: {
        color: string;
        id: number;
        particles: {
          [filename: string]: string[]
        }
      }
    }
  } = { classes: {} };
  let imageFiles: File[] = [];
  let csvFiles: File[] = [];
  let currentImageFile: File | null = null;
  let currentCsvFile: File | null = null;
  let zoomFactor = 1;
  let borderWidth = 2;
  let fillOpacity = 0.2;
  let outlinesHidden = false;
  let originalBorderWidth = borderWidth;
  let originalFillOpacity = fillOpacity;
  let newClassName = '';
  let newClassColor = '#ff0000';
  let selectedClass = 'Unclassified';
  let UTIF: any = null;
  
  // Svelte action to add webkitdirectory attribute
  function addWebkitDirectory(node: HTMLElement) {
    // @ts-ignore - TypeScript doesn't know about webkitdirectory
    node.webkitdirectory = true;
    // @ts-ignore
    node.directory = true;
    return {};
  }

  // Element references
  let imageFolderInputElement: HTMLInputElement;
  let imageDropdownElement: HTMLSelectElement;
  let csvFolderInputElement: HTMLInputElement;
  let csvDropdownElement: HTMLSelectElement;
  let globalScaleInputElement: HTMLInputElement;
  let borderWidthInputElement: HTMLInputElement;
  let fillOpacityInputElement: HTMLInputElement;
  let classColorInputElement: HTMLInputElement;
  let colorPreviewElement: HTMLElement;
  let classNameInputElement: HTMLInputElement;
  let classSelectElement: HTMLSelectElement;
  let countersContainerElement: HTMLElement;
  let canvasElement: HTMLCanvasElement;
  let scrollContainerElement: HTMLElement;
  let zoomLevelElement: HTMLElement;

  onMount(() => {
    // Dynamically import UTIF to avoid SSR issues
    (async () => {
      try {
        const utifModule = await import('utif');
        UTIF = utifModule.default || utifModule;
        console.log("UTIF loaded successfully:", UTIF);
      } catch (error) {
        console.error("Error loading UTIF:", error);
      }
    })();

    // Add keyboard event listener for 'E' key
    document.addEventListener('keydown', handleKeyDown);

    // Initial setup
    updateZoomDisplay();
    updateClassCounters();
    redrawCanvas();

    return () => {
      // Clean up event listeners
      document.removeEventListener('keydown', handleKeyDown);
    };
  });

  function handleKeyDown(event: KeyboardEvent) {
    // Ignore if typing in an input field or select box
    if (document.activeElement instanceof HTMLInputElement || 
        document.activeElement instanceof HTMLSelectElement) {
      return;
    }

    if (event.key.toLowerCase() === 'e') {
      event.preventDefault();

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
      if (borderWidthInputElement) borderWidthInputElement.value = borderWidth.toString();
      if (fillOpacityInputElement) fillOpacityInputElement.value = fillOpacity.toString();

      // Redraw the canvas with new settings
      redrawCanvas();
    }
  }

  function updateZoomDisplay() {
    if (zoomLevelElement) {
      zoomLevelElement.textContent = `${Math.round(zoomFactor * 100)}%`;
    }
  }

  function handleStyleChange() {
    borderWidth = parseFloat(borderWidthInputElement.value) || 0;
    fillOpacity = parseFloat(fillOpacityInputElement.value) || 0;
    originalBorderWidth = borderWidth;
    originalFillOpacity = fillOpacity;
    outlinesHidden = false;
    redrawCanvas();
  }

  function handleColorInputChange() {
    if (colorPreviewElement && classColorInputElement) {
      colorPreviewElement.style.backgroundColor = classColorInputElement.value;
    }
  }

  function updateClassCounters() {
    if (!countersContainerElement) return;
    countersContainerElement.innerHTML = '';
    
    for (const className in classificationData.classes) {
      if (!classificationData.classes.hasOwnProperty(className)) continue;
      
      const classInfo = classificationData.classes[className];
      const counterDiv = document.createElement('div');
      counterDiv.className = 'class-counter';
      counterDiv.style.backgroundColor = classInfo.color;
      
      const hex = classInfo.color.slice(1);
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      counterDiv.style.color = luminance < 128 ? 'white' : 'black';
      
      let count = 0;
      for (const filename in classInfo.particles) {
        if (classInfo.particles.hasOwnProperty(filename)) {
          count += classInfo.particles[filename]?.length || 0;
        }
      }
      
      counterDiv.textContent = `${className}: ${count}`;
      countersContainerElement.appendChild(counterDiv);
    }
    
    const unclassifiedCounterDiv = document.createElement('div');
    unclassifiedCounterDiv.className = 'class-counter';
    unclassifiedCounterDiv.style.backgroundColor = '#3d3d3d';
    unclassifiedCounterDiv.style.color = 'white';
    
    let unclassifiedCount = 0;
    if (data && data.length > 1 && currentCsvFile) {
      const totalParticles = data.length - 1;
      let classifiedCountCurrentFile = 0;
      const filename = currentCsvFile.name;
      
      for (const className in classificationData.classes) {
        if (classificationData.classes.hasOwnProperty(className)) {
          const classInfo = classificationData.classes[className];
          classifiedCountCurrentFile += classInfo.particles?.[filename]?.length ?? 0;
        }
      }
      
      unclassifiedCount = Math.max(0, totalParticles - classifiedCountCurrentFile);
    }
    
    unclassifiedCounterDiv.textContent = `Unclassified: ${unclassifiedCount}`;
    countersContainerElement.appendChild(unclassifiedCounterDiv);
  }

  function getParticleColor(particleId: string) {
    if (!currentCsvFile || !classificationData || !classificationData.classes) return '#3d3d3d';
    
    const filename = currentCsvFile.name;
    const numericId = String(particleId).replace(/^Nucleus_/i, '');
    
    for (const className in classificationData.classes) {
      if (classificationData.classes.hasOwnProperty(className)) {
        const classInfo = classificationData.classes[className];
        if (classInfo?.particles?.[filename]?.includes(numericId)) {
          return classInfo.color;
        }
      }
    }
    
    return '#3d3d3d';
  }

  function getRGBAFromColor(color: string, opacity: number) {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    
    if (!color) return `rgba(128, 128, 128, ${clampedOpacity})`;
    
    try {
      let r, g, b;
      
      if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
        let hex = color.slice(1);
        if (hex.length === 3) {
          hex = hex.split('').map(c => c + c).join('');
        }
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      } else if (color.startsWith('rgb(')) {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          r = parseInt(match[1]);
          g = parseInt(match[2]);
          b = parseInt(match[3]);
        } else {
          throw new Error("Invalid RGB format");
        }
      } else {
        return `rgba(128, 128, 128, ${clampedOpacity})`;
      }
      
      if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return `rgba(128, 128, 128, ${clampedOpacity})`;
      }
      
      return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`;
    } catch (e) {
      console.warn("Could not parse color:", color, e);
      return `rgba(128, 128, 128, ${clampedOpacity})`;
    }
  }

  function redrawCanvas() {
    if (!canvasElement || !canvasElement.getContext) return;
    
    const ctx = canvasElement.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;
    
    const container = scrollContainerElement;
    
    // Ensure canvas dimensions are updated based on zoom
    const baseWidth = imageScaleInfo ? imageScaleInfo.imgWidth : canvasElement.width / zoomFactor;
    const baseHeight = imageScaleInfo ? imageScaleInfo.imgHeight : canvasElement.height / zoomFactor;
    
    const maxWidth = 16384; // Common canvas size limit
    const maxHeight = 16384;
    const targetWidth = Math.min(baseWidth * zoomFactor, maxWidth);
    const targetHeight = Math.min(baseHeight * zoomFactor, maxHeight);
    
    if (canvasElement.width !== targetWidth || canvasElement.height !== targetHeight) {
      canvasElement.width = targetWidth;
      canvasElement.height = targetHeight;
    }
    
    canvasElement.style.width = `${canvasElement.width}px`;
    canvasElement.style.height = `${canvasElement.height}px`;
    
    // Clear the entire canvas
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Draw Background Image (if loaded)
    if (backgroundImage && imageScaleInfo) {
      const { scale, imgWidth, imgHeight, offsetX, offsetY } = imageScaleInfo;
      
      ctx.drawImage(
        backgroundImage,
        0, 0, imgWidth, imgHeight, // Source rectangle
        offsetX * zoomFactor, offsetY * zoomFactor, canvasElement.width, canvasElement.height // Destination rectangle
      );
    } else {
      // Fill with a background color if no image is loaded
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    }
    
    // Draw particles
    if (data && imageScaleInfo && data.length > 1) {
      const { scale, offsetX, offsetY } = imageScaleInfo;
      const headers = data[0];
      const globalScale = parseFloat(globalScaleInputElement?.value || "1") || 1;
      const invGlobalScale = 1.0 / globalScale;
      
      // Combined scale factor including zoom
      const scaleFactor = invGlobalScale * scale * zoomFactor;
      
      // Calculate viewport boundaries in canvas coordinates
      const viewLeft = container.scrollLeft;
      const viewTop = container.scrollTop;
      const viewRight = viewLeft + container.clientWidth;
      const viewBottom = viewTop + container.clientHeight;
      
      // Add margin for drawing elements slightly outside the viewport
      const margin = 50 * zoomFactor;
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const n = Object.fromEntries(headers.map((header: string, j: number) => [header, row[j]]));
        
        const xValue = parseFloat(n.X || 0);
        const yValue = parseFloat(n.Y || 0);
        const majorValue = parseFloat(n.Major || 0);
        const minorValue = parseFloat(n.Minor || 0);
        const angleValue = parseFloat(n.Angle || 0);
        
        // Skip if essential values are invalid or zero
        if (isNaN(xValue) || isNaN(yValue) || !majorValue || !minorValue) continue;
        
        // Calculate ellipse parameters in canvas coordinates
        const major = majorValue * scaleFactor;
        const minor = minorValue * scaleFactor;
        const angle = -(angleValue * Math.PI) / 180.0; // Convert degrees to radians, negate for canvas rotation
        const x = xValue * scaleFactor + offsetX * zoomFactor;
        const y = yValue * scaleFactor + offsetY * zoomFactor;
        
        const particleId = row[0]; // Assuming first column is ID
        const particleColor = getParticleColor(particleId);
        
        // Viewport Culling: Check if the ellipse's bounding box intersects the visible area + margin
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

  async function handleImageFolder(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const files = Array.from(input.files);
    imageFiles = files.filter(f => /\.(tiff?|png|jpe?g|bmp)$/i.test(f.name));
    
    if (imageDropdownElement) {
      imageDropdownElement.innerHTML = '<option value="">Select an image file from folder</option>';
      
      imageFiles.sort((a, b) => a.name.localeCompare(b.name)).forEach(file => {
        const option = document.createElement('option');
        option.value = file.webkitRelativePath || file.name;
        option.textContent = file.name;
        imageDropdownElement.appendChild(option);
      });
      
      imageDropdownElement.style.display = 'block';
    }
    
    // Log the files found to help with debugging
    console.log(`Found ${imageFiles.length} image files in the selected folder`);
    
    // Reset relevant state when folder changes
    backgroundImage = null;
    imageScaleInfo = null;
    redrawCanvas(); // Clear canvas
  }

  function handleImageSelection(event: Event) {
    const select = event.target as HTMLSelectElement;
    const selectedFile = select.value;
    
    if (!selectedFile) {
      backgroundImage = null; // Clear image if no file is selected
      redrawCanvas();
      return;
    }
    
    currentImageFile = imageFiles.find(f => (f.webkitRelativePath || f.name) === selectedFile) || null;
    if (currentImageFile) loadImageFile(currentImageFile);
  }

  function handleCSVFolder(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const files = Array.from(input.files);
    csvFiles = files.filter(f => /\.csv$/i.test(f.name));
    
    if (csvDropdownElement) {
      csvDropdownElement.innerHTML = '<option value="">Select a CSV file from folder</option>';
      
      csvFiles.sort((a, b) => a.name.localeCompare(b.name)).forEach(file => {
        const option = document.createElement('option');
        option.value = file.webkitRelativePath || file.name;
        option.textContent = file.name;
        csvDropdownElement.appendChild(option);
      });
      
      csvDropdownElement.style.display = 'block';
    }
    // Log the files found to help with debugging
    console.log(`Found ${csvFiles.length} CSV files in the selected folder`);
    
    
    // Reset relevant state when folder changes
    data = null;
    currentCsvFile = null;
    updateClassCounters(); // Reset counters
    redrawCanvas(); // Redraw (will show only image if loaded)
  }

  function handleCSVSelection(event: Event) {
    const select = event.target as HTMLSelectElement;
    const selectedFile = select.value;
    
    if (!selectedFile) {
      data = null; // Clear data if "Select a CSV" is chosen
      currentCsvFile = null;
      updateClassCounters();
      redrawCanvas();
      return;
    }
    
    currentCsvFile = csvFiles.find(f => (f.webkitRelativePath || f.name) === selectedFile) || null;
    if (currentCsvFile) loadCSVFile(currentCsvFile);
  }

  async function loadImageFile(file: File) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      let bitmap;

      if (/\.tiff?$/i.test(file.name)) {
        if (!UTIF) {
          console.error("UTIF library not loaded");
          alert("UTIF library not loaded. Cannot process TIFF files.");
          return;
        }

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

      // Set initial canvas dimensions based on image
      if (canvasElement) {
        canvasElement.width = bitmap.width * zoomFactor; // Apply initial zoom
        canvasElement.height = bitmap.height * zoomFactor; // Apply initial zoom
        canvasElement.style.width = `${canvasElement.width}px`;
        canvasElement.style.height = `${canvasElement.height}px`;
      }

      // Center canvas after setting dimensions
      if (scrollContainerElement && canvasElement) {
        scrollContainerElement.scrollLeft = (canvasElement.width - scrollContainerElement.clientWidth) / 2;
        scrollContainerElement.scrollTop = (canvasElement.height - scrollContainerElement.clientHeight) / 2;
      }

      redrawCanvas(); // Initial draw
    } catch (error) {
      console.error('Image processing error:', error);
      alert('Error processing image file: ' + (error instanceof Error ? error.message : String(error)));
      backgroundImage = null; // Reset on error
      imageScaleInfo = null;
      redrawCanvas(); // Clear canvas on error
    }
  }

  function loadCSVFile(file: File) {
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

        const headers = results.meta.fields || [];
        
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
        data = [headers, ...results.data.filter((row: any) => {
          // Ensure the first column exists and starts with 'Nucleus_' (case-insensitive)
          const firstColVal = row[headers[0]];
          return typeof firstColVal === 'string' && firstColVal.toLowerCase().startsWith('nucleus_');
        }).map((row: any) => headers.map((header: string) => row[header]))]; // Keep original header case

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

  function handleCanvasClick(event: MouseEvent) {
    if (!data || !imageScaleInfo || !currentCsvFile) return;

    const rect = canvasElement.getBoundingClientRect();
    const mouseX = (event.clientX - rect.left) / zoomFactor;
    const mouseY = (event.clientY - rect.top) / zoomFactor;

    const { scale, offsetX, offsetY } = imageScaleInfo;
    const globalScale = parseFloat(globalScaleInputElement?.value || "1") || 1;
    const invGlobalScale = 1.0 / globalScale;
    const scaleFactor = invGlobalScale * scale;

    // Find clicked particle
    for (const [index, row] of data.slice(1).entries()) {
      const headers = data[0];
      const n = Object.fromEntries(headers.map((header: string, i: number) => [header, row[i]]));

      const xValue = parseFloat(n.X);
      const yValue = parseFloat(n.Y);
      const majorValue = parseFloat(n.Major);
      const minorValue = parseFloat(n.Minor);

      if (isNaN(xValue) || isNaN(yValue)) continue;

      const originalMajor = majorValue * scaleFactor;
      const originalMinor = minorValue * scaleFactor;
      const originalX = xValue * scaleFactor + offsetX;
      const originalY = yValue * scaleFactor + offsetY;

      // Ellipse hit testing
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
              classificationData.classes[cls].particles[filename] = classificationData.classes[cls].particles[filename].filter((id: string) => id !== particleId);
            }
          });

          if (!classificationData.classes[selectedClass].particles[filename].includes(particleId)) {
            classificationData.classes[selectedClass].particles[filename].push(particleId);
          }
        } else {
          Object.keys(classificationData.classes).forEach(cls => {
            if (classificationData.classes[cls].particles[filename]) {
              classificationData.classes[cls].particles[filename] = classificationData.classes[cls].particles[filename].filter((id: string) => id !== particleId);
            }
          });
        }

        redrawCanvas();
        updateClassCounters(); // Update counters after click
        return; // Exit loop after finding the particle
      }
    }
  }

  function addClass() {
    if (!newClassName.trim()) return;

    const className = newClassName.trim();
    const color = newClassColor;

    // Add to classification data
    if (!classificationData.classes[className]) {
      classificationData.classes[className] = {
        color: color,
        id: Object.keys(classificationData.classes).length + 1,
        particles: {}
      };
    }

    newClassName = '';
    updateClassCounters(); // update counters after adding class
  }

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

    input.addEventListener('change', (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const result = e.target?.result;
          if (typeof result !== 'string') {
            throw new Error("Invalid file content");
          }
          
          const loaded = JSON.parse(result);
          
          // Basic validation: check if it has a 'classes' property
          if (!loaded || typeof loaded.classes !== 'object') {
            throw new Error("Invalid classification file format.");
          }
          
          classificationData = loaded;

          redrawCanvas();
          updateClassCounters(); //update the counters
          alert('Classification data loaded successfully');
        } catch (error) {
          console.error('Error parsing JSON or invalid format:', error);
          alert('Error loading classification file: ' + (error instanceof Error ? error.message : String(error)));
        }
      };
      reader.onerror = () => {
        alert('Error reading the classification file.');
      };
      reader.readAsText(file);
    });

    input.click();
  }

  function zoomIn() {
    zoomFactor *= 1.2;
    updateZoomDisplay();
    redrawCanvas();
  }

  function zoomOut() {
    zoomFactor /= 1.2;
    if (zoomFactor < 0.1) zoomFactor = 0.1;
    updateZoomDisplay();
    redrawCanvas();
  }

  function resetZoom() {
    zoomFactor = 1;
    updateZoomDisplay();
    redrawCanvas();
  }
</script>

<div class="container flex flex-col items-center p-5 mx-auto">
  <h1 class="text-3xl font-bold text-light-blue-700 mb-5 text-center">Cell Selection Tool</h1>
  <h3 class="text-m font-bold text-gray-700 mb-5 text-center">This webpage is still under testing, if you have issues try downloading the html file</h3>

  <div class="controls bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 mb-5 w-[90%] max-w-[1200px] grid grid-cols-1 md:grid-cols-2 gap-5">
    <div class="control-group flex flex-col gap-3">
      <h3 class="text-lg font-semibold text-blue-700">Input Files</h3>
      <div>
        <label class="file-input-label bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded cursor-pointer inline-block" for="imageFolderInput">
          Choose Image Folder
        </label>
        <input type="file" id="imageFolderInput" bind:this={imageFolderInputElement} on:change={handleImageFolder} multiple class="hidden" use:addWebkitDirectory />
      </div>
      <select id="imageDropdown" bind:this={imageDropdownElement} on:change={handleImageSelection} class="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" style="display: none;"></select>

      <div>
        <label class="file-input-label bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded cursor-pointer inline-block" for="csvFolderInput">
          Choose Cell Data Folder
        </label>
        <input type="file" id="csvFolderInput" bind:this={csvFolderInputElement} on:change={handleCSVFolder} multiple class="hidden" use:addWebkitDirectory />
      </div>
      <select id="csvDropdown" bind:this={csvDropdownElement} on:change={handleCSVSelection} class="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" style="display: none;"></select>
    </div>

    <div class="control-group flex flex-col gap-3">
      <h3 class="text-lg font-semibold text-blue-700">Display Settings</h3>
      <div class="settings-group flex flex-col gap-2">
        <div class="setting-row flex items-center gap-2">
          <label for="globalScale">Scale:</label>
          <input type="number" id="globalScale" bind:this={globalScaleInputElement} value="1" step="0.01" min="0.01" max="2" class="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" on:input={redrawCanvas} />
        </div>
        <div class="setting-row flex items-center gap-2">
          <label for="borderWidth">Border Width:</label>
          <input type="number" id="borderWidth" bind:this={borderWidthInputElement} value={borderWidth} step="0.5" min="0" class="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" on:input={handleStyleChange} />
        </div>
        <div class="setting-row flex items-center gap-2">
          <label for="fillOpacity">Fill Opacity:</label>
          <input type="number" id="fillOpacity" bind:this={fillOpacityInputElement} value={fillOpacity} step="0.05" min="0" max="1" class="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" on:input={handleStyleChange} />
        </div>
      </div>

      <div class="zoom-controls flex items-center gap-2">
        <label>Zoom:</label>
        <button on:click={zoomOut} class="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded">-</button>
        <span id="zoomLevel" bind:this={zoomLevelElement} class="mx-2">100%</span>
        <button on:click={zoomIn} class="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded">+</button>
        <button on:click={resetZoom} class="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded">Reset</button>
      </div>
    </div>
  </div>

  <div class="class-controls bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-5 flex flex-row items-center gap-3">
    <input type="color" id="classColor" bind:this={classColorInputElement} bind:value={newClassColor} on:input={handleColorInputChange} class="w-10 h-10 p-0 border border-gray-300 dark:border-gray-600 rounded" />
    <span class="color-preview w-5 h-5 border border-gray-300 dark:border-gray-600 rounded inline-block ml-1" bind:this={colorPreviewElement}></span>
    <input type="text" id="className" placeholder="Enter class name" bind:this={classNameInputElement} bind:value={newClassName} class="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 min-w-[150px]" />
    <button id="addClassBtn" on:click={addClass} class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded whitespace-nowrap">Add Class</button>
    <select id="classSelect" bind:this={classSelectElement} bind:value={selectedClass} class="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white min-w-[180px]">
      <option value="Unclassified" style="background-color: #3d3d3d; color: white;">Unclassified</option>
      {#each Object.entries(classificationData.classes) as [name, info] (name)}
      <option value={name} style="background-color: {info.color}; color: { ( (0.299 * parseInt(info.color.slice(1,3), 16) + 0.587 * parseInt(info.color.slice(3,5), 16) + 0.114 * parseInt(info.color.slice(5,7), 16)) < 128 ? 'white' : 'black' ) }">
        {name}
      </option>
      {/each}
    </select>
  </div>

  <!-- Counters Section -->
  <div class="counters-container flex flex-wrap justify-center gap-2 mb-5" id="countersContainer" bind:this={countersContainerElement}>
    <!-- Class counters are dynamically added here -->
  </div>

  <!-- Canvas Section -->
  <div class="canvas-container w-[90vw] h-[70vh] overflow-auto border-2 border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 relative shadow-inner mx-auto" id="scrollContainer" bind:this={scrollContainerElement} on:scroll={redrawCanvas}>
    <canvas id="canvas" bind:this={canvasElement} on:click={handleCanvasClick} class="block bg-gray-200 dark:bg-gray-700"></canvas>
  </div>

  <!-- Save/Load Section -->
  <div class="save-load-buttons flex justify-center gap-4 mt-5 mb-5">
    <button id="saveData" on:click={saveData} class="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded">Save Classification</button>
    <button id="loadData" on:click={loadData} class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded">Load Classification</button>
  </div>
</div>

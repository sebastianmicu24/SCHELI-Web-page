<svelte:head>
  <title>Cell Visualization Tool</title>
  <meta name="description" content="Cell Visualization Tool for analyzing cell data" />
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  // Remove styles.css import to prevent global style conflicts
  import Papa from 'papaparse';
  import type { ParseResult } from 'papaparse';
  
  // We'll dynamically import UTIF to avoid SSR issues
  let UTIF: any = null;
  
  // Svelte action to add webkitdirectory attribute
  function addWebkitDirectory(node: HTMLElement) {
    // @ts-ignore - TypeScript doesn't know about webkitdirectory
    node.webkitdirectory = true;
    // @ts-ignore
    node.directory = true;
    return {};
  }

  // --- Type Definitions ---
  interface ImageScaleInfo {
    scale: number;
    offsetX: number;
    offsetY: number;
    imgWidth: number;
    imgHeight: number;
  }

  // --- State Variables ---
  let imageFiles: File[] = [];
  let currentImageFile: File | null = null;
  let data: string[][] | null = null; // Holds FULL parsed CSV data [headers, [row1], ...]
  let backgroundImage: HTMLImageElement | ImageBitmap | null = null;
  let imageScaleInfo: ImageScaleInfo | null = null;
  let currentFilterValue: string = ""; // Bound to filter dropdown
  let originalFileColIndex: number = -1; // Index of the 'Original_File' column in CSV
  let zoomFactor: number = 1;
  let borderWidth: number = 2;
  let fillOpacity: number = 0.2;
  let globalScaleValue: number = 1;
  let uniqueFilterValues: string[] = []; // For the filter dropdown
  
  // UI colors map - used as FALLBACK if CSV color is missing/invalid
  let classColors: { [key: string]: string } = {
    '0': '#ff0000',
    '1': '#00ff00',
    '2': '#0000ff',
    '3': '#ffff00',
    'unclassified': '#808080' // Color for indices not in map or invalid CSV color
  };
  
  // Store mapping from Predicted_Class_Index to Predicted_Class_Name
  let classNameMap: { [key: string]: string } = {};

  // --- Element References ---
  let canvasElement: HTMLCanvasElement;
  let scrollContainerElement: HTMLDivElement;
  let imageDropdownElement: HTMLSelectElement;
  let filterDropdownElement: HTMLSelectElement;
  let countersContainerElement: HTMLDivElement;
  let zoomLevelElement: HTMLSpanElement;
  let imageFolderNameElement: HTMLSpanElement;
  let csvFileNameElement: HTMLSpanElement;

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
    
    // Initialize color previews
    initializeColorPreviews();
    updateZoomDisplay();
    updateClassCounters(); // Show initial state
    redrawCanvas(); // Initial draw
  });

  // --- UI Update Functions ---
  function updateZoomDisplay() {
    if (zoomLevelElement) zoomLevelElement.textContent = `${Math.round(zoomFactor * 100)}%`;
  }

  function initializeColorPreviews() {
    // Update color previews in the DOM
    document.querySelectorAll('.color-preview').forEach((preview) => {
      const element = preview as HTMLElement;
      const classIndex = element.dataset.classIndex;
      if (classIndex && classColors[classIndex]) {
        element.style.backgroundColor = classColors[classIndex];
      }
    });
  }

  function handleColorInput(classIndex: string) {
    redrawCanvas();
    updateClassCounters();
  }

  function updateClassCounters() {
    if (!countersContainerElement) return;
    countersContainerElement.innerHTML = '';

    if (!data || data.length < 2 || !currentFilterValue) {
      countersContainerElement.textContent = 'Load CSV data and select a file filter.';
      return;
    }

    const counts: { [key: string]: number } = {};
    const headers = data[0];
    const predictedIndexCol = headers.indexOf('Predicted_Class_Index');
    const predictedNameCol = headers.indexOf('Predicted_Class_Name');

    if (predictedIndexCol === -1 || originalFileColIndex === -1) {
      const missing = [];
      if (predictedIndexCol === -1) missing.push('"Predicted_Class_Index"');
      if (originalFileColIndex === -1) missing.push('"Original_File"');
      countersContainerElement.textContent = `CSV missing required column(s): ${missing.join(' and ')}.`;
      return;
    }

    Object.keys(classColors).forEach(key => { counts[key] = 0; });
    classNameMap = {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[originalFileColIndex] !== currentFilterValue) continue;

      const predictedIndexRaw = row[predictedIndexCol];
      const indexStr = String(predictedIndexRaw).trim();
      const predictedName = (predictedNameCol !== -1 && row[predictedNameCol]) 
        ? String(row[predictedNameCol]).trim() 
        : `Index ${indexStr}`;

      if (!classNameMap[indexStr] && indexStr !== 'unclassified') {
        classNameMap[indexStr] = predictedName;
      }

      if (predictedIndexRaw !== null && predictedIndexRaw !== undefined && classColors.hasOwnProperty(indexStr)) {
        counts[indexStr]++;
      } else {
        counts['unclassified']++;
      }
    }

    let totalCount = 0;
    for (const classIndex in counts) {
      const count = counts[classIndex];
      if (count === 0 && !classColors.hasOwnProperty(classIndex)) continue;

      totalCount += count;
      const color = classColors[classIndex] || classColors['unclassified'];
      let label = `Index ${classIndex}`;
      if (classIndex === 'unclassified') label = 'Other/NA';
      else if (classNameMap[classIndex]) label = classNameMap[classIndex];

      appendCounter(label, count, color);
    }

    if (totalCount === 0) {
      countersContainerElement.textContent = `No cells found for filter "${currentFilterValue}".`;
    }
  }

  function appendCounter(name: string, count: number, color: string) {
    if (!countersContainerElement) return;
    const counterDiv = document.createElement('div');
    counterDiv.classList.add('class-counter');
    counterDiv.style.backgroundColor = color;
    try {
      const hex = color.startsWith('#') ? color.slice(1) : '808080';
      if (hex.length === 6 || hex.length === 3) {
        const r = parseInt(hex.length === 3 ? hex[0]+hex[0] : hex.slice(0,2), 16);
        const g = parseInt(hex.length === 3 ? hex[1]+hex[1] : hex.slice(2,4), 16);
        const b = parseInt(hex.length === 3 ? hex[2]+hex[2] : hex.slice(4,6), 16);
        if(!isNaN(r) && !isNaN(g) && !isNaN(b)){
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
          counterDiv.style.color = luminance < 128 ? 'white' : 'black';
        } else { counterDiv.style.color = 'black'; }
      } else { counterDiv.style.color = 'black'; }
    } catch(e) { console.warn("Color parse error:", e); counterDiv.style.color = 'black'; }
    counterDiv.textContent = `${name}: ${count}`;
    countersContainerElement.appendChild(counterDiv);
  }

  // --- Event Handlers ---
  function handleStyleChange() { redrawCanvas(); }
  function handleGlobalScaleChange() { redrawCanvas(); }

  // --- Zoom Handlers ---
  function zoomIn() { zoomFactor *= 1.2; updateZoomDisplay(); redrawCanvas(); }
  function zoomOut() { zoomFactor /= 1.2; if (zoomFactor < 0.1) zoomFactor = 0.1; updateZoomDisplay(); redrawCanvas(); }
  function resetZoom() {
    zoomFactor = 1;
    updateZoomDisplay();
    if (backgroundImage && imageScaleInfo && canvasElement && scrollContainerElement) {
      const { imgWidth, imgHeight, scale } = imageScaleInfo;
      const targetWidth = imgWidth * scale * zoomFactor;
      const targetHeight = imgHeight * scale * zoomFactor;
      if (canvasElement.width !== targetWidth || canvasElement.height !== targetHeight) {
        canvasElement.width = targetWidth; canvasElement.height = targetHeight;
        canvasElement.style.width = `${targetWidth}px`; canvasElement.style.height = `${targetHeight}px`;
      }
      requestAnimationFrame(() => {
        scrollContainerElement.scrollTo({
          left: (targetWidth - scrollContainerElement.clientWidth) / 2,
          top: (targetHeight - scrollContainerElement.clientHeight) / 2,
          behavior: 'smooth'
        });
      });
    }
    redrawCanvas();
  }

  // --- File Handling ---
  async function handleImageFolder(event: Event) {
    console.log("Image folder selection triggered");
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files || []);
    imageFiles = files.filter(f => /\.(tiff?|png|jpe?g|bmp)$/i.test(f.name))
                      .sort((a, b) => a.name.localeCompare(b.name));
    imageFiles = [...imageFiles]; // Trigger reactivity

    if (imageFolderNameElement) imageFolderNameElement.textContent = files.length > 0 ? `${files.length} file(s) selected` : '';
    if (imageDropdownElement) imageDropdownElement.style.display = imageFiles.length > 0 ? 'block' : 'none';

    backgroundImage = null; imageScaleInfo = null; currentImageFile = null;
    if (imageDropdownElement) imageDropdownElement.value = "";
    matchFilesAndLoad();
  }

  function handleImageSelection(event: Event) {
    const selectedPath = (event.target as HTMLSelectElement).value;
    if (!selectedPath) {
      backgroundImage = null; imageScaleInfo = null; currentImageFile = null; redrawCanvas(); return;
    }
    currentImageFile = imageFiles.find(f => ((f as any).webkitRelativePath || f.name) === selectedPath) || null;
    if (currentImageFile) {
      loadImageFile(currentImageFile);
      matchFilesAndLoad();
    } else {
      console.error("Selected image file not found:", selectedPath);
      backgroundImage = null; imageScaleInfo = null; redrawCanvas();
    }
  }

  function handleCSVFile(event: Event) {
    console.log("CSV file selection triggered");
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    data = null; originalFileColIndex = -1; currentFilterValue = ""; classNameMap = {}; uniqueFilterValues = [];
    if (filterDropdownElement) { filterDropdownElement.innerHTML = ''; filterDropdownElement.style.display = 'none'; filterDropdownElement.value = ""; }
    if (csvFileNameElement) csvFileNameElement.textContent = '';

    if (!file) { redrawCanvas(); updateClassCounters(); return; }

    if (!/\.csv$/i.test(file.name)) {
      alert("Please select a valid .csv file."); target.value = ''; return;
    }
    if (csvFileNameElement) csvFileNameElement.textContent = file.name;
    loadCSVFile(file);
  }

  function handleFilterSelection(event: Event) {
    currentFilterValue = (event.target as HTMLSelectElement).value; // Value is bound
    console.log("Filter selected:", currentFilterValue);
    
    // Only call matchFilesAndLoad if we're not already in a matching process
    if (!isMatchingInProgress) {
      matchFilesAndLoad();
    } else {
      console.log("Skipping matchFilesAndLoad call from handleFilterSelection due to recursion prevention");
    }
    
    updateClassCounters();
    redrawCanvas();
  }

  // Flag to prevent infinite recursion
  let isMatchingInProgress = false;

  function matchFilesAndLoad() {
    // Prevent infinite recursion
    if (isMatchingInProgress) {
      console.log("Matching already in progress, skipping recursive call");
      return;
    }

    isMatchingInProgress = true;
    
    try {
      // Try matching filter to image
      if (currentFilterValue && !currentImageFile && imageFiles.length > 0) {
        const matchedImage = imageFiles.find(img => img.name.startsWith(currentFilterValue!));
        if (matchedImage) {
          console.log(`Auto-matched Filter "${currentFilterValue}" to Image "${matchedImage.name}"`);
          if (imageDropdownElement) {
            const imagePath = (matchedImage as any).webkitRelativePath || matchedImage.name;
            imageDropdownElement.value = imagePath;
            // Trigger image loading by simulating selection change
            handleImageSelection({ target: imageDropdownElement } as unknown as Event);
            isMatchingInProgress = false;
            return; // Image load will trigger redraw
          }
        } else { console.log(`No image found starting with filter "${currentFilterValue}"`); }
      }
      // Try matching image to filter
      else if (currentImageFile && data && !currentFilterValue && uniqueFilterValues.length > 0) {
        const imageBaseName = currentImageFile.name;
        const matchedFilter = uniqueFilterValues.find(filterVal => imageBaseName.startsWith(filterVal));
        if (matchedFilter) {
          console.log(`Auto-matched Image "${imageBaseName}" to Filter "${matchedFilter}"`);
          if (filterDropdownElement) {
            filterDropdownElement.value = matchedFilter;
            // Set currentFilterValue directly instead of calling handleFilterSelection
            currentFilterValue = matchedFilter;
            console.log("Setting filter value directly to:", currentFilterValue);
            updateClassCounters();
            redrawCanvas();
            isMatchingInProgress = false;
            return;
          }
        } else { console.log(`No filter value found matching image "${imageBaseName}"`); }
      }
      // If no match or conditions not met, ensure redraw/counters update
      updateClassCounters();
      redrawCanvas();
    } finally {
      isMatchingInProgress = false;
    }
  }

  async function loadImageFile(file: File) {
    console.log("Loading image:", file.name);
    try {
      const arrayBuffer = await file.arrayBuffer();
      let bitmap: ImageBitmap;

      if (/\.tiff?$/i.test(file.name)) {
        if (!UTIF) {
          console.error("UTIF library not loaded");
          alert("UTIF library not loaded. Cannot process TIFF files.");
          return;
        }
        
        const uint8Array = new Uint8Array(arrayBuffer);
        const ifds = UTIF.decode(uint8Array);
        if (!ifds || ifds.length === 0) throw new Error("Could not decode TIFF IFDs.");
        const page = ifds[0];
        UTIF.decodeImage(uint8Array, page);
        const rgba = UTIF.toRGBA8(page);
        console.log(`TIFF Decoded: ${page.width}x${page.height}`);
        const imageData = new ImageData(new Uint8ClampedArray(rgba), page.width, page.height);
        bitmap = await createImageBitmap(imageData);
        
        // For TIFF files, use the bitmap directly instead of creating an HTMLImageElement
        backgroundImage = bitmap;
      } else {
        bitmap = await createImageBitmap(new Blob([arrayBuffer], { type: file.type }));
        console.log(`Image Decoded: ${bitmap.width}x${bitmap.height}`);
        
        // For non-TIFF files, we can still use the original approach
        const img = new Image();
        const dataUrl = await blobToDataURL(new Blob([arrayBuffer], { type: file.type }));
        img.src = dataUrl;
        await img.decode();
        backgroundImage = img;
      }

      imageScaleInfo = { scale: 1, offsetX: 0, offsetY: 0, imgWidth: bitmap.width, imgHeight: bitmap.height };

      if (canvasElement) {
        canvasElement.width = imageScaleInfo.imgWidth * zoomFactor;
        canvasElement.height = imageScaleInfo.imgHeight * zoomFactor;
        canvasElement.style.width = `${canvasElement.width}px`;
        canvasElement.style.height = `${canvasElement.height}px`;
        if (scrollContainerElement) {
          scrollContainerElement.scrollTo({ left: (canvasElement.width - scrollContainerElement.clientWidth) / 2, top: (canvasElement.height - scrollContainerElement.clientHeight) / 2 });
        }
      }
      redrawCanvas();

    } catch (error: any) {
      console.error('Image processing error:', error);
      alert(`Error processing image file: ${error.message}`);
      backgroundImage = null; imageScaleInfo = null; currentImageFile = null;
      if (imageDropdownElement) imageDropdownElement.value = "";
      redrawCanvas();
    }
  }

  function blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function loadCSVFile(file: File) {
    console.log("Loading CSV:", file.name);
    classNameMap = {};

    Papa.parse<string[]>(file, {
      header: false,
      delimiter: ";",
      dynamicTyping: false, // Parse numbers manually with parseFloatSafe
      skipEmptyLines: true,
      complete: (results: ParseResult<string[]>) => {
        if (!results.data || results.data.length < 2) {
          alert('CSV file is empty or has no data rows.');
          data = null;
          originalFileColIndex = -1;
          currentFilterValue = "";
          uniqueFilterValues = [];
          if(filterDropdownElement) {
            filterDropdownElement.innerHTML = '';
            filterDropdownElement.style.display = 'none';
            filterDropdownElement.value = "";
          }
          redrawCanvas();
          updateClassCounters();
          return;
        }
        
        const headers = results.data[0];
        const rows = results.data.slice(1);
        console.log("CSV Parsed. Headers:", headers);

        originalFileColIndex = headers.indexOf('Original_File');
        if (originalFileColIndex === -1) {
          alert("CSV missing required 'Original_File' column.");
          data = null;
          originalFileColIndex = -1;
          currentFilterValue = "";
          uniqueFilterValues = [];
          if(filterDropdownElement) {
            filterDropdownElement.innerHTML = '';
            filterDropdownElement.style.display = 'none';
            filterDropdownElement.value = "";
          }
          redrawCanvas();
          updateClassCounters();
          return;
        }

        data = [headers, ...rows];
        console.log(`Found ${rows.length} data rows.`);

        // Extract unique filter values and populate dropdown
        uniqueFilterValues = [...new Set(rows.map(row => row[originalFileColIndex]))].filter(Boolean).sort((a, b) => a.localeCompare(b));
        
        if (filterDropdownElement) {
          // Clear and repopulate the dropdown
          filterDropdownElement.innerHTML = '<option value="">Select File Filter from CSV</option>';
          
          uniqueFilterValues.forEach(fileName => {
            const option = document.createElement('option');
            option.value = fileName;
            option.textContent = fileName;
            filterDropdownElement.appendChild(option);
          });
          
          filterDropdownElement.style.display = uniqueFilterValues.length > 0 ? 'block' : 'none';
          filterDropdownElement.value = ""; // Reset selection
        }
        
        currentFilterValue = ""; // Reset filter selection
        
        if (uniqueFilterValues.length === 0) {
          alert("No unique file identifiers found in 'Original_File' column.");
        }

        // Check required columns for drawing and coloring
        const requiredCols = ['Nucleus_X', 'Nucleus_Y', 'Nucleus_Major', 'Nucleus_Minor', 'Predicted_Class_Index'];
        const recommendedCols = ['Predicted_Class_Color', 'Predicted_Class_Name'];
        
        const missingRequired = requiredCols.filter(col => !headers.includes(col));
        const missingRecommended = recommendedCols.filter(col => !headers.includes(col));
        
        if (missingRequired.length > 0) {
          alert(`CSV missing required columns for drawing/coloring: ${missingRequired.join(', ')}`);
        }
        
        if (missingRecommended.length > 0) {
          console.warn(`CSV missing recommended columns: ${missingRecommended.join(', ')}`);
        }

        // Try to match files after loading CSV
        matchFilesAndLoad();
      },
      error: (error: any) => {
        console.error('CSV parsing error:', error);
        alert(`Error parsing CSV file: ${error.message}`);
        data = null;
        originalFileColIndex = -1;
        currentFilterValue = "";
        classNameMap = {};
        uniqueFilterValues = [];
        if(filterDropdownElement) {
          filterDropdownElement.innerHTML = '';
          filterDropdownElement.style.display = 'none';
          filterDropdownElement.value = "";
        }
        redrawCanvas();
        updateClassCounters();
      }
    });
  }

  // --- Drawing Logic ---
  function getParticleDrawColor(particleRowData: string[], headers: string[]): string {
    if (!particleRowData || !headers) return classColors['unclassified'];
    const colorCol = headers.indexOf('Predicted_Class_Color');
    const indexCol = headers.indexOf('Predicted_Class_Index');

    if (colorCol !== -1) {
      const csvColor = particleRowData[colorCol];
      if (csvColor && typeof csvColor === 'string' && csvColor.startsWith('#')) return csvColor;
    }
    if (indexCol !== -1) {
      const predictedIndexRaw = particleRowData[indexCol];
      if (predictedIndexRaw !== null && predictedIndexRaw !== undefined) {
         const indexStr = String(predictedIndexRaw).trim();
         if (classColors.hasOwnProperty(indexStr)) return classColors[indexStr];
      }
    }
    return classColors['unclassified'];
  }

  function getRGBAFromColor(color: string, opacity: number): string {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    if (!color) return `rgba(128, 128, 128, ${clampedOpacity})`;
    try {
      let r: number, g: number, b: number;
      if (color.startsWith('#')) {
        let hex = color.slice(1);
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        if (hex.length !== 6) throw new Error("Invalid hex length");
        [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
      } else if (color.startsWith('rgb')) {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) throw new Error("Invalid RGB");
        [r, g, b] = match.slice(1, 4).map(Number);
      } else throw new Error("Invalid color format");
      if (isNaN(r) || isNaN(g) || isNaN(b)) throw new Error("Invalid color values");
      return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`;
    } catch (e: any) {
      console.warn("Color parse error:", e);
      return `rgba(128, 128, 128, ${clampedOpacity})`;
    }
  }

  function parseFloatSafe(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return NaN;
    const strValue = String(value);
    const cleanedStr = /^\s*-?\d+,?\d*\s*$/.test(strValue) ? strValue.replace(',', '.') : strValue;
    return parseFloat(cleanedStr);
  }

  function redrawCanvas() {
    if (!canvasElement) return;
    const ctx = canvasElement.getContext('2d');
    if (!ctx || !scrollContainerElement) return;

    const baseWidth = imageScaleInfo ? imageScaleInfo.imgWidth : (canvasElement.width / zoomFactor);
    const baseHeight = imageScaleInfo ? imageScaleInfo.imgHeight : (canvasElement.height / zoomFactor);

    const maxWidth = 16384; const maxHeight = 16384;
    const targetWidth = Math.min(baseWidth * zoomFactor, maxWidth);
    const targetHeight = Math.min(baseHeight * zoomFactor, maxHeight);

    if (canvasElement.width !== targetWidth || canvasElement.height !== targetHeight) {
      canvasElement.width = targetWidth;
      canvasElement.height = targetHeight;
    }
    canvasElement.style.width = `${targetWidth}px`;
    canvasElement.style.height = `${targetHeight}px`;

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    if (backgroundImage && imageScaleInfo) {
      const { imgWidth, imgHeight, offsetX, offsetY } = imageScaleInfo;
      
      // Draw the image - handle both ImageBitmap and HTMLImageElement
      if (backgroundImage instanceof ImageBitmap) {
        // For ImageBitmap (TIFF files), use source and destination rectangles
        ctx.drawImage(
          backgroundImage,
          0, 0, imgWidth, imgHeight, // Source rectangle
          offsetX * zoomFactor, offsetY * zoomFactor, canvasElement.width, canvasElement.height // Destination rectangle
        );
      } else {
        // For HTMLImageElement (non-TIFF files), use the previous approach
        ctx.drawImage(backgroundImage, offsetX * zoomFactor, offsetY * zoomFactor, canvasElement.width, canvasElement.height);
      }
    } else {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
      ctx.fillStyle = '#aaa'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Load an image folder', canvasElement.width / 2, canvasElement.height / 2);
    }

    if (data && data.length > 1 && imageScaleInfo && currentFilterValue && originalFileColIndex !== -1) {
      const headers = data[0];
      const xCol = headers.indexOf('Nucleus_X');
      const yCol = headers.indexOf('Nucleus_Y');
      const majorCol = headers.indexOf('Nucleus_Major');
      const minorCol = headers.indexOf('Nucleus_Minor');
      const angleCol = headers.indexOf('Nucleus_Angle');

      if (xCol === -1 || yCol === -1 || majorCol === -1 || minorCol === -1) {
         ctx.fillStyle = 'orange'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
         ctx.fillText('Warning: Missing essential Nucleus columns in CSV!', canvasElement.width / 2, 30);
      } else {
        const { scale, offsetX, offsetY } = imageScaleInfo;
        const invGlobalScale = 1.0 / globalScaleValue;
        const scaleFactor = invGlobalScale * scale * zoomFactor;

        const viewLeft = scrollContainerElement.scrollLeft;
        const viewTop = scrollContainerElement.scrollTop;
        const viewRight = viewLeft + scrollContainerElement.clientWidth;
        const viewBottom = viewTop + scrollContainerElement.clientHeight;
        const margin = 50 * zoomFactor;

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row[originalFileColIndex] !== currentFilterValue) continue;

          const xValue = parseFloatSafe(row[xCol]);
          const yValue = parseFloatSafe(row[yCol]);
          const majorValue = parseFloatSafe(row[majorCol]);
          const minorValue = parseFloatSafe(row[minorCol]);
          const angleValue = (angleCol !== -1) ? parseFloatSafe(row[angleCol]) : 0;

          if (isNaN(xValue) || isNaN(yValue) || isNaN(majorValue) || isNaN(minorValue) || majorValue <= 0 || minorValue <= 0) continue;

          const major = majorValue * scaleFactor;
          const minor = minorValue * scaleFactor;
          const angle = -(angleValue * Math.PI) / 180.0;
          const x = (xValue * invGlobalScale * scale + offsetX) * zoomFactor;
          const y = (yValue * invGlobalScale * scale + offsetY) * zoomFactor;

          const halfMajor = major / 2.0;
          const halfMinor = minor / 2.0;
          const maxRadius = Math.max(halfMajor, halfMinor) * 1.1;

          if (x + maxRadius < viewLeft - margin || x - maxRadius > viewRight + margin ||
              y + maxRadius < viewTop - margin || y - maxRadius > viewBottom + margin) {
            continue;
          }

          const particleColor = getParticleDrawColor(row, headers);
          ctx.save();
          ctx.strokeStyle = particleColor;
          if (fillOpacity > 0) ctx.fillStyle = getRGBAFromColor(particleColor, fillOpacity);
          if (borderWidth > 0) ctx.lineWidth = borderWidth;

          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.ellipse(0, 0, halfMajor, halfMinor, 0, 0, 2 * Math.PI);

          if (fillOpacity > 0) ctx.fill();
          if (borderWidth > 0) ctx.stroke();
          ctx.restore();
        }
      }
    } else if (data && data.length > 1 && !currentFilterValue) {
      ctx.fillStyle = '#aaa'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
      if (backgroundImage) {
        ctx.fillText('Select a file filter to view cells', canvasElement.width / 2, canvasElement.height / 2 + 30);
      }
    }
  }
</script>

<div class="bg-gray-100 dark:bg-gray-900 min-h-screen">
  <div class="container mx-auto py-8 px-4">
    <h1 class="text-3xl font-bold text-center text-blue-700 dark:text-blue-400 mb-6">Cell Visualization Tool</h1>
    <h3 class="text-m font-bold text-gray-700 mb-5 text-center">This webpage is still under testing, if you have issues try downloading the html file</h3>

    <!-- Controls Section -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Input Files Group -->
      <div class="border border-gray-300 dark:border-gray-700 p-3 rounded">
        <h3 class="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-3">Input Files</h3>
        <div class="mb-2">
          <label class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded cursor-pointer" for="imageFolderInput">Choose Image Folder</label>
          <input type="file" id="imageFolderInput" multiple on:change={handleImageFolder} class="hidden" use:addWebkitDirectory />
          <span bind:this={imageFolderNameElement} class="ml-2 italic text-sm text-gray-600 dark:text-gray-400"></span>
        </div>
        
        <select bind:this={imageDropdownElement} on:change={handleImageSelection} class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white mb-4" style="display: none;">
          <option value="">Select an image file from folder</option>
          {#each imageFiles as file}
            <option value={(file as any).webkitRelativePath || file.name}>{file.name}</option>
          {/each}
        </select>

        <div class="mt-3">
          <label class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded cursor-pointer" for="csvFileInput">Choose Cell Data File (.csv)</label>
          <input type="file" id="csvFileInput" accept=".csv" on:change={handleCSVFile} class="hidden" />
          <span bind:this={csvFileNameElement} class="ml-2 italic text-sm text-gray-600 dark:text-gray-400"></span>
        </div>
        
        <div class="filter-group mt-3">
          <label for="filterDropdown" class="block mb-1 text-sm font-medium">Filter by Original File:</label>
          <select id="filterDropdown" bind:this={filterDropdownElement} on:change={handleFilterSelection} class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white" style="display: none;">
            <option value="">Select File Filter from CSV</option>
            {#each uniqueFilterValues as filterVal}
              <option value={filterVal}>{filterVal}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Display Settings Group -->
      <div class="border border-gray-300 dark:border-gray-700 p-3 rounded">
        <h3 class="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-3">Display Settings</h3>
        <div class="settings-group space-y-2">
          <div class="setting-row flex items-center gap-2">
            <label for="globalScale" class="w-24">Scale:</label>
            <input type="number" id="globalScale" step="0.01" min="0.01" max="2" bind:value={globalScaleValue} on:input={handleGlobalScaleChange} class="flex-grow p-1 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div class="setting-row flex items-center gap-2">
            <label for="borderWidth" class="w-24">Border Width:</label>
            <input type="number" id="borderWidth" step="0.5" min="0" bind:value={borderWidth} on:input={handleStyleChange} class="flex-grow p-1 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div class="setting-row flex items-center gap-2">
            <label for="fillOpacity" class="w-24">Fill Opacity:</label>
            <input type="number" id="fillOpacity" step="0.05" min="0" max="1" bind:value={fillOpacity} on:input={handleStyleChange} class="flex-grow p-1 border rounded dark:bg-gray-700 dark:border-gray-600" />
          </div>
        </div>

        <div class="zoom-controls flex items-center gap-2 mt-3">
          <label class="w-24">Zoom:</label>
          <button on:click={zoomOut} class="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded">-</button>
          <span bind:this={zoomLevelElement} class="px-2">100%</span>
          <button on:click={zoomIn} class="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded">+</button>
          <button on:click={resetZoom} class="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded">Reset</button>
        </div>
      </div>
    </div>

    <!-- Class Color Controls Section -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-5 flex flex-row flex-wrap justify-center items-center gap-4">
      <h3 class="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-3 w-full">Class Colors (Fallback)</h3>
      
      <div class="color-control-group flex items-center gap-2">
        <label for="class0Color">Index 0:</label>
        <input type="color" id="class0Color" bind:value={classColors['0']} on:input={() => handleColorInput('0')} class="w-8 h-8 p-0 border rounded" />
        <span class="color-preview w-5 h-5 border rounded inline-block" data-class-index="0" style="background-color: {classColors['0']};"></span>
      </div>
      
      <div class="color-control-group flex items-center gap-2">
        <label for="class1Color">Index 1:</label>
        <input type="color" id="class1Color" bind:value={classColors['1']} on:input={() => handleColorInput('1')} class="w-8 h-8 p-0 border rounded" />
        <span class="color-preview w-5 h-5 border rounded inline-block" data-class-index="1" style="background-color: {classColors['1']};"></span>
      </div>
      
      <div class="color-control-group flex items-center gap-2">
        <label for="class2Color">Index 2:</label>
        <input type="color" id="class2Color" bind:value={classColors['2']} on:input={() => handleColorInput('2')} class="w-8 h-8 p-0 border rounded" />
        <span class="color-preview w-5 h-5 border rounded inline-block" data-class-index="2" style="background-color: {classColors['2']};"></span>
      </div>
      
      <div class="color-control-group flex items-center gap-2">
        <label for="class3Color">Index 3:</label>
        <input type="color" id="class3Color" bind:value={classColors['3']} on:input={() => handleColorInput('3')} class="w-8 h-8 p-0 border rounded" />
        <span class="color-preview w-5 h-5 border rounded inline-block" data-class-index="3" style="background-color: {classColors['3']};"></span>
      </div>
      
      <div class="color-control-group flex items-center gap-2">
        <label for="unclassifiedColor">Other/NA:</label>
        <input type="color" id="unclassifiedColor" bind:value={classColors['unclassified']} on:input={() => handleColorInput('unclassified')} class="w-8 h-8 p-0 border rounded" />
        <span class="color-preview w-5 h-5 border rounded inline-block" data-class-index="unclassified" style="background-color: {classColors['unclassified']};"></span>
      </div>
    </div>

    <!-- Counters Section -->
    <div class="flex flex-wrap justify-center gap-2 mb-5" bind:this={countersContainerElement}>
      <!-- Class counters dynamically added -->
    </div>

    <!-- Canvas Section -->
    <div class="w-[90vw] h-[70vh] overflow-auto border-2 border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 relative shadow-inner mx-auto" bind:this={scrollContainerElement} on:scroll={redrawCanvas}>
      <canvas bind:this={canvasElement} class="block bg-gray-200 dark:bg-gray-700"></canvas>
    </div>
  </div>
</div>

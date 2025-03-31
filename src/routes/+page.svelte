<svelte:head>
  <title>Sebastian Micu</title>
  <meta name="description" content="Portfolio website for Sebastian Micu" />
</svelte:head>

<div class="container mx-auto py-8">
  <header class="text-center mb-8">
    <h1 class="text-3xl font-bold mb-2">SCHELI Plugin</h1>
    <p class="text-gray-400">Segmentation and Classification for Hematoxylin Eosin Liver Images</p>
  </header>

  <section class="mb-8">
    <h2 class="text-2xl font-bold mb-4">About SCHELI</h2>
    <p class="text-gray-300">
      SCHELI (Segmentation and Classification for Hematoxylin Eosin Liver Images) is an ImageJ/Fiji plugin that automates the analysis of H&E-stained liver microscopy images. It processes image batches by segmenting cells, nuclei, cytoplasm, and vessels, then saves comprehensive measurements including shape, size, and stain color information to CSV format. Users can define custom cell classes and train XGBoost models to classify all cells in the segmented dataset. The plugin features two web interfaces for interactive cell classification and results visualization, which can be used locally or via this website with complete data privacy. Detailed information about configuration options and performance metrics is available in the documentation.
    </p>
  </section>

  <section class="mb-8">
    <div class="flex justify-center gap-4 mt-4">
      <a href="/download" class="inline-block bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        Download
      </a>
      <a href="/docs" class="inline-block bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        Documentation
      </a>
      <a href="/manual-cell-classifier" class="inline-block bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        Manual Cell Classifier
      </a>
      <a href="/cell-visualizer" class="inline-block bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        Cell Visualizer
      </a>
    </div>
  </section>

  <section class="mb-8">
    <h2 class="text-2xl font-bold mb-4 text-center">SCHELI Installation</h2>
    <div class="relative aspect-w-16 aspect-h-9 mx-auto" style="max-width: 800px;">
      <iframe src="https://www.youtube.com/embed/BkNhT8zFRWk" title="SCHELI Plugin Installation Tutorial" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="w-full h-full"></iframe>
    </div>
  </section>

  <section class="mb-8">
    <h2 class="text-2xl font-bold mb-4">About Me</h2>
    <p class="text-gray-500 text-sm">
    My name is Sebastian Micu, a 6th year Medicine Student at Sapienza University of Rome with a passion for Programming and Machine Learning. I developed SCHELI as part of my thesis research, with support from the Centro de Biología Molecular Severo Ochoa in Madrid. This project combines my interests in medical imaging and computational analysis to create accessible tools for histology research. SCHELI represents my contribution to open-source scientific software, designed to help researchers analyze liver tissue samples more efficiently.
    </p>
  </section>

  <footer class="text-center text-gray-500 mt-8">
    © 2025 Sebastian Micu
  </footer>
</div>

console.log("Rawy is running in the browser. Eventually on Muse.");

const app = document.getElementById("app")!;

app.innerHTML = `
  <aside id="sidebar">
    <h1>RAWY</h1>
  </aside>

  <main id="editor">
    <textarea placeholder="Start writing..."></textarea>
  </main>
`;

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Controller for about:limb-search.
 *
 * Runs in the privileged about: page context. Creates a SearchService
 * using the chrome window's BrowsingTree and optional storage, then
 * renders instant search results as the user types.
 *
 * See spec unified-tree.md S5.
 */

const GLOBE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><ellipse cx="8" cy="8" rx="3" ry="6.5"/><line x1="1.5" y1="8" x2="14.5" y2="8"/></svg>`;

function formatRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function createResultElement(result) {
  const el = document.createElement("div");
  el.className = "search-result";
  el.dataset.nodeId = result.nodeId;
  el.dataset.branchRootId = result.branchRootId;

  const favicon = document.createElement("span");
  favicon.className = "search-result-favicon";
  if (result.favicon) {
    const img = document.createElement("img");
    img.src = result.favicon;
    img.width = 16;
    img.height = 16;
    img.alt = "";
    favicon.appendChild(img);
  } else {
    favicon.innerHTML = GLOBE_SVG;
  }

  const body = document.createElement("div");
  body.className = "search-result-body";

  const title = document.createElement("div");
  title.className = "search-result-title";
  title.textContent = result.title || result.url;

  const url = document.createElement("div");
  url.className = "search-result-url";
  url.textContent = result.url;

  const meta = document.createElement("div");
  meta.className = "search-result-meta";

  const branch = document.createElement("span");
  branch.textContent = result.branchName || "Unknown branch";

  const time = document.createElement("span");
  time.textContent = formatRelativeTime(result.timestamp);

  meta.appendChild(branch);
  meta.appendChild(time);

  body.appendChild(title);
  body.appendChild(url);
  body.appendChild(meta);

  el.appendChild(favicon);
  el.appendChild(body);

  return el;
}

function init() {
  const input = document.getElementById("search-input");
  const container = document.getElementById("results-container");
  const noResults = document.getElementById("no-results");

  const chromeWindow = window.browsingContext?.topChromeWindow;
  if (!chromeWindow) return;

  const { SearchService } = ChromeUtils.importESModule(
    "chrome://browser/content/limb/search/SearchService.mjs",
    { global: "current" }
  );

  const tree = chromeWindow.gLimbBrowsingTree;
  if (!tree) return;

  const storage = chromeWindow.gLimbTreeStorage ?? null;
  const treeView = chromeWindow.gLimbTreeView;

  const searchProbe = {
    searchExecuted(query, count) {
      console.debug("Search:", query, "->", count, "results");
    },
  };

  const service = new SearchService(tree, storage, searchProbe);

  let debounceTimer = null;

  input.addEventListener("input", () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      performSearch(input.value);
    }, 100);
  });

  async function performSearch(query) {
    const results = await service.search(query);

    container.textContent = "";

    if (!query.trim()) {
      noResults.hidden = true;
      return;
    }

    if (results.length === 0) {
      noResults.hidden = false;
      return;
    }

    noResults.hidden = true;
    for (const result of results) {
      container.appendChild(createResultElement(result));
    }
  }

  container.addEventListener("click", (e) => {
    const resultEl = e.target.closest(".search-result");
    if (!resultEl) return;

    const nodeId = resultEl.dataset.nodeId;
    const branchRootId = resultEl.dataset.branchRootId;

    if (!nodeId) return;

    // If node is in the active branch, focus it directly
    if (branchRootId === tree.activeBranchId) {
      tree.focusNode(nodeId);
      if (treeView) {
        treeView.setFocusedNodeId(nodeId);
        treeView.animateToNode(nodeId, 1);
      }
      return;
    }

    // Node is in an inactive branch; activate it first
    if (branchRootId && storage) {
      tree.switchBranch(branchRootId, storage).then(() => {
        tree.focusNode(nodeId);
        if (treeView) {
          treeView.setFocusedNodeId(nodeId);
          treeView.animateToNode(nodeId, 1);
        }
      });
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

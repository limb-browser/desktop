// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Launcher page controller for about:limb-home.
 *
 * Runs in the privileged about: page context. Reads branch data from
 * the chrome window's BrowsingTree via window.browsingContext and
 * renders branch cards grouped by time.
 *
 * See spec unified-tree.md S2.
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

const DELETE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>`;

function createBranchCard(branch) {
  const card = document.createElement("div");
  card.className = "branch-card";
  card.dataset.nodeId = branch.id;

  const header = document.createElement("div");
  header.className = "branch-card-header";

  const favicon = document.createElement("span");
  favicon.className = "branch-favicon";
  if (branch.favicon) {
    const img = document.createElement("img");
    img.src = branch.favicon;
    img.width = 16;
    img.height = 16;
    img.alt = "";
    favicon.appendChild(img);
  } else {
    favicon.innerHTML = GLOBE_SVG;
  }

  const name = document.createElement("span");
  name.className = "branch-name";
  name.textContent = branch.name || "Untitled";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "branch-delete";
  deleteBtn.title = "Delete branch";
  deleteBtn.innerHTML = DELETE_SVG;
  deleteBtn.dataset.branchId = branch.id;

  header.appendChild(favicon);
  header.appendChild(name);
  header.appendChild(deleteBtn);

  const meta = document.createElement("div");
  meta.className = "branch-meta";

  const count = document.createElement("span");
  count.textContent = `${branch.nodeCount} ${branch.nodeCount === 1 ? "page" : "pages"}`;

  const time = document.createElement("span");
  time.textContent = formatRelativeTime(branch.lastVisitedAt);

  meta.appendChild(count);
  meta.appendChild(time);

  if (branch.screenshot) {
    const thumbnail = document.createElement("img");
    thumbnail.className = "branch-thumbnail";
    thumbnail.src = branch.screenshot;
    thumbnail.alt = "";
    card.appendChild(thumbnail);
  }

  card.appendChild(header);
  card.appendChild(meta);

  return card;
}

function renderLauncher(launcherData, container, emptyState) {
  container.textContent = "";

  if (launcherData.isEmpty) {
    emptyState.hidden = false;
    container.hidden = true;
    return;
  }

  emptyState.hidden = true;
  container.hidden = false;

  for (const group of launcherData.groups) {
    const section = document.createElement("div");
    section.className = "time-group";

    const heading = document.createElement("h2");
    heading.className = "time-group-heading";
    heading.textContent = group.label;
    section.appendChild(heading);

    const list = document.createElement("div");
    list.className = "time-group-list";

    for (const branch of group.branches) {
      list.appendChild(createBranchCard(branch));
    }

    section.appendChild(list);
    container.appendChild(section);
  }
}

function init() {
  const container = document.getElementById("branches-container");
  const emptyState = document.getElementById("empty-state");
  const newBranchBtn = document.getElementById("new-branch");
  const startBrowsingBtn = document.getElementById("start-browsing");

  // Access the chrome window to get the BrowsingTree
  const chromeWindow = window.browsingContext?.topChromeWindow;
  if (!chromeWindow) {
    emptyState.hidden = false;
    container.hidden = true;
    return;
  }

  const getLauncherData = ChromeUtils.importESModule("chrome://browser/content/limb/home/LauncherDataSource.ts", { global: "current" }).getLauncherData;

  const tree = chromeWindow.gLimbBrowsingTree;
  if (!tree) {
    emptyState.hidden = false;
    container.hidden = true;
    return;
  }

  const branchRouter = chromeWindow.gLimbBranchRouter;

  function refresh() {
    const data = getLauncherData(tree, Date.now());
    renderLauncher(data, container, emptyState);
  }

  refresh();

  container.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".branch-delete");
    if (deleteBtn) {
      e.stopPropagation();
      const branchId = deleteBtn.dataset.branchId;
      if (branchId && branchRouter) {
        branchRouter.deleteBranch(branchId).then(refresh);
      }
      return;
    }

    const card = e.target.closest(".branch-card");
    if (!card) return;
    const nodeId = card.dataset.nodeId;
    if (nodeId && tree.nodes.has(nodeId)) {
      tree.focusNode(nodeId);
    }
  });

  function createNewBranch() {
    if (branchRouter) {
      branchRouter.createBranch().then(refresh);
    } else {
      const homeUrl = Services.prefs.getStringPref("limb.home.url", "about:blank");
      const branch = tree.addChild(tree.rootId, homeUrl);
      tree.focusNode(branch.id);
      refresh();
    }
  }

  newBranchBtn.addEventListener("click", createNewBranch);
  startBrowsingBtn.addEventListener("click", createNewBranch);

  const settingsGear = document.getElementById("settings-gear");
  settingsGear.addEventListener("click", () => {
    const browser = chromeWindow.gBrowser?.selectedBrowser;
    if (browser) {
      browser.loadURI(Services.io.newURI("about:limb-settings"), {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

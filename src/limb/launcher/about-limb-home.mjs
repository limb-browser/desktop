// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * about:limb-home launcher page script.
 *
 * Renders the root node's children (branches) grouped by time.
 * Runs in a chrome-privileged about: page context.
 *
 * Wire-up: reads branches from the global LimbController (set up by
 * browser chrome startup code) and renders them as cards.
 */

const GLOBE_ICON = "\u{1F310}";

/**
 * Create a branch card DOM element.
 * @param {object} branch - A RenderableBranch (pre-computed by LauncherController)
 * @returns {HTMLElement}
 */
function createBranchCard(branch) {
  const card = document.createElement("div");
  card.className = "branch-card";
  card.dataset.branchId = branch.id;

  const faviconEl = document.createElement("div");
  faviconEl.className = "branch-card-favicon";
  if (branch.favicon) {
    const img = document.createElement("img");
    img.src = branch.favicon;
    img.alt = "";
    faviconEl.appendChild(img);
  } else {
    faviconEl.textContent = GLOBE_ICON;
  }

  const infoEl = document.createElement("div");
  infoEl.className = "branch-card-info";

  const nameEl = document.createElement("div");
  nameEl.className = "branch-card-name";
  nameEl.textContent = branch.title || "Untitled";

  const metaEl = document.createElement("div");
  metaEl.className = "branch-card-meta";
  const pageLabel = branch.descendantCount === 1 ? "page" : "pages";
  metaEl.textContent = `${branch.descendantCount} ${pageLabel} \u00B7 ${branch.relativeTime}`;

  infoEl.appendChild(nameEl);
  infoEl.appendChild(metaEl);

  card.appendChild(faviconEl);
  card.appendChild(infoEl);

  if (branch.screenshotUrl) {
    const thumb = document.createElement("img");
    thumb.className = "branch-card-thumbnail";
    thumb.src = branch.screenshotUrl;
    thumb.alt = "";
    card.appendChild(thumb);
  }

  card.addEventListener("click", () => {
    const event = new CustomEvent("limb-branch-select", {
      detail: { branchId: branch.id },
    });
    document.dispatchEvent(event);
  });

  return card;
}

/**
 * Create the "+" new branch card.
 * @returns {HTMLElement}
 */
function createNewBranchCard() {
  const card = document.createElement("div");
  card.className = "new-branch-card";

  const plus = document.createElement("span");
  plus.className = "new-branch-plus";
  plus.textContent = "+";

  const label = document.createElement("span");
  label.textContent = "New Branch";

  card.appendChild(plus);
  card.appendChild(label);

  card.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("limb-branch-create"));
  });

  return card;
}

/**
 * Render the launcher UI.
 * @param {Array<{label: string, branches: object[]}>} groups - Pre-computed RenderableTimeGroup[]
 */
function render(groups) {
  const branchList = document.getElementById("branch-list");
  const emptyState = document.getElementById("empty-state");

  branchList.innerHTML = "";

  if (groups.length === 0) {
    branchList.hidden = true;
    emptyState.hidden = false;
    return;
  }

  branchList.hidden = false;
  emptyState.hidden = true;

  for (const group of groups) {
    const groupEl = document.createElement("div");
    groupEl.className = "time-group";

    const heading = document.createElement("div");
    heading.className = "time-group-heading";
    heading.textContent = group.label;

    const cardsEl = document.createElement("div");
    cardsEl.className = "time-group-cards";

    for (const branch of group.branches) {
      cardsEl.appendChild(createBranchCard(branch));
    }

    groupEl.appendChild(heading);
    groupEl.appendChild(cardsEl);
    branchList.appendChild(groupEl);
  }

  // Add "+" card at the end of the first group
  const firstGroup = branchList.querySelector(".time-group-cards");
  if (firstGroup) {
    firstGroup.appendChild(createNewBranchCard());
  }
}

// Wire up the empty-state Start Browsing button
document.getElementById("start-browsing-btn").addEventListener("click", () => {
  document.dispatchEvent(new CustomEvent("limb-branch-create"));
});

// Expose render for browser chrome integration
window.LimbLauncherRender = render;

// Notify chrome that the launcher is ready
document.dispatchEvent(new CustomEvent("limb-launcher-ready"));

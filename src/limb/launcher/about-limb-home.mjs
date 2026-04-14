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
 * Compute which time group a timestamp belongs to.
 * @param {number} timestamp
 * @param {number} now
 * @returns {string}
 */
function classifyTimestamp(timestamp, now) {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(now);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  startOfYesterday.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  const day = startOfWeek.getDay();
  const diff = (day + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - diff);

  const startOfMonth = new Date(now);
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  if (timestamp >= startOfDay.getTime()) return "Today";
  if (timestamp >= startOfYesterday.getTime()) return "Yesterday";
  if (timestamp >= startOfWeek.getTime()) return "This Week";
  if (timestamp >= startOfMonth.getTime()) return "This Month";

  const d = new Date(timestamp);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * @param {number} timestamp
 * @param {number} now
 * @returns {string}
 */
function relativeTime(timestamp, now) {
  const diffMs = now - timestamp;
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (hours < 1) return `${minutes} minutes ago`;
  if (hours === 1) return "1 hour ago";
  if (days < 1) return `${hours} hours ago`;
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/**
 * Create a branch card DOM element.
 * @param {object} branch
 * @param {number} now
 * @returns {HTMLElement}
 */
function createBranchCard(branch, now) {
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
  nameEl.textContent = branch.title || branch.url || "Untitled";

  const metaEl = document.createElement("div");
  metaEl.className = "branch-card-meta";
  const pageLabel = branch.descendantCount === 1 ? "page" : "pages";
  metaEl.textContent = `${branch.descendantCount} ${pageLabel} \u00B7 ${relativeTime(branch.lastVisitedAt, now)}`;

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
 * @param {object[]} branches - Array of BranchInfo objects
 */
function render(branches) {
  const now = Date.now();
  const branchList = document.getElementById("branch-list");
  const emptyState = document.getElementById("empty-state");

  branchList.innerHTML = "";

  if (branches.length === 0) {
    branchList.hidden = true;
    emptyState.hidden = false;
    return;
  }

  branchList.hidden = false;
  emptyState.hidden = true;

  // Group branches by time
  const groupOrder = ["Today", "Yesterday", "This Week", "This Month"];
  const groups = new Map();

  for (const branch of branches) {
    const label = classifyTimestamp(branch.lastVisitedAt, now);
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label).push(branch);
  }

  // Sort branches within each group by lastVisitedAt descending
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
  }

  // Render in order: fixed groups first, then older months
  const fixedLabels = groupOrder.filter((l) => groups.has(l));
  const olderLabels = [...groups.keys()]
    .filter((l) => !groupOrder.includes(l))
    .sort((a, b) => {
      const latestA = Math.max(...groups.get(a).map((br) => br.lastVisitedAt));
      const latestB = Math.max(...groups.get(b).map((br) => br.lastVisitedAt));
      return latestB - latestA;
    });

  const orderedLabels = [...fixedLabels, ...olderLabels];

  for (const label of orderedLabels) {
    const groupEl = document.createElement("div");
    groupEl.className = "time-group";

    const heading = document.createElement("div");
    heading.className = "time-group-heading";
    heading.textContent = label;

    const cardsEl = document.createElement("div");
    cardsEl.className = "time-group-cards";

    for (const branch of groups.get(label)) {
      cardsEl.appendChild(createBranchCard(branch, now));
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

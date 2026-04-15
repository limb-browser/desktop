// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export interface ZoomOutAndBackProbe {
  animationStarted(fromLevel: number, holdLevel: number, toLevel: number): void;
  phaseChanged(phase: 'zoom-out' | 'hold' | 'zoom-in'): void;
  animationCompleted(): void;
  animationCancelled(): void;
}

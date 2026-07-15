// Workaround for a SurveyJS + React StrictMode crash (survey-react-ui 2.5.x).
//
// When `creator.JSON` is assigned after mount (our case: the survey arrives
// from the API), the previous designer survey model is disposed. React's
// StrictMode dev-remount ("reappearLayoutEffects") then re-runs
// componentDidMount on the already-unmounted dropdown components, whose
// question is disposed — `question.dropdownListModel` is a lazy getter that
// returns undefined for disposed questions, and updateInputDomElement reads
// `.inputStringRendered` off it unguarded:
//
//   Uncaught TypeError: Cannot read properties of undefined
//   (reading 'inputStringRendered')
//     at SurveyQuestionDropdown.updateInputDomElement
//     at SurveyQuestionDropdown.componentDidMount
//
// The library already guards componentWillUnmount with
// `if (this.question.dropdownListModel)` — this patch applies the same guard
// to updateInputDomElement. Safe no-op for live questions; latest stable
// (2.5.34) still lacks the guard, so remove this once upstream fixes it.

import { SurveyQuestionDropdownBase } from "survey-react-ui";

let applied = false;

export function applySurveyCreatorPatches(): void {
  if (applied) return;
  applied = true;

  const proto = (SurveyQuestionDropdownBase as any)?.prototype;
  const original = proto?.updateInputDomElement;
  if (typeof original !== "function") return;

  proto.updateInputDomElement = function (...args: unknown[]) {
    if (!this.question || this.question.isDisposed || !this.question.dropdownListModel) {
      return;
    }
    return original.apply(this, args);
  };
}

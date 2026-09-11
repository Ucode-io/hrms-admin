import { Link } from "react-router";
import type { CopilotLink } from "../types";

/** A button that continues the task on an HRMS page. */
const CopilotLinkButton: React.FC<{
  link: CopilotLink;
  onNavigate?: () => void;
}> = ({ link, onNavigate }) => {
  const className =
    "block rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400";

  const body = (
    <>
      {link.label}
      {link.description && (
        <span className="mt-0.5 block text-xs font-normal opacity-70">
          {link.description}
        </span>
      )}
    </>
  );

  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer" className={className}>
        {body}
      </a>
    );
  }

  return (
    <Link to={link.href} className={className} onClick={onNavigate}>
      {body}
    </Link>
  );
};

export default CopilotLinkButton;

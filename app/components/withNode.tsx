import { Fragment, type ReactNode } from "react";

const MARK = "\u0000";

// Place un élément React (une heure locale, un lien…) dans une phrase traduite
// construite par une fonction du dictionnaire, sans découper la traduction.
export function withNode(template: (value: string) => string, node: ReactNode): ReactNode {
  const [before, after] = template(MARK).split(MARK);
  return (
    <Fragment>
      {before}
      {node}
      {after}
    </Fragment>
  );
}

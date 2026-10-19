import {
  useId,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";

export default function Tooltip({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <span className="tooltip-anchor" data-tooltip={text}>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{
              "aria-describedby"?: string;
              title?: string;
            }>,
            { "aria-describedby": id, title: undefined },
          )
        : children}
      <span id={id} className="ui-tooltip" role="tooltip">
        {text}
      </span>
    </span>
  );
}

import { expect, it } from "vitest";
import cases from "./endpoint-policy-cases.json";
import { validEndpoint } from "./sources";

it.each(cases)(
  "endpoint policy $url (LAN consent $lan)",
  ({ url, lan, valid }) => {
    expect(validEndpoint(url, lan)).toBe(valid);
  },
);

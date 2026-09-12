export function serializeJsonLd(data: unknown): string {
  // Script content cannot contain </script>, which would end the HTML element.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

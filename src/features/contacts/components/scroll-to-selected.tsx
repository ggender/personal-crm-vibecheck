"use client";

import { useEffect } from "react";

// After a reload or a new contact, the selected row may be far down the list.
export function ScrollToSelected({
  selectedId,
}: {
  selectedId: number | null;
}) {
  useEffect(() => {
    if (selectedId === null) {
      return;
    }
    document
      .querySelector(`[data-contact-id="${selectedId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);
  return null;
}

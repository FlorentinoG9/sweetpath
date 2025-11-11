import type { Marker } from "./types";

export interface MarkerElement {
  element: HTMLElement;
  teardown: () => void;
}

export function createMarkerElement(marker: Marker, onRemove: () => void): MarkerElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className =
    "group inline-flex items-center justify-center rounded-full border-2 border-white bg-primary shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  element.style.width = "32px";
  element.style.height = "32px";
  element.style.borderRadius = "50% 50% 50% 0";
  element.style.cursor = "pointer";
  element.style.transformOrigin = "center";
  element.style.willChange = "transform";

  // Create wrapper div for the icon to avoid transform conflicts
  const wrapper = document.createElement("div");
  wrapper.style.width = "100%";
  wrapper.style.height = "100%";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "center";
  wrapper.style.transform = "rotate(45deg)";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "white");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  );

  svg.appendChild(path);
  wrapper.appendChild(svg);
  element.appendChild(wrapper);

  // Set initial transform - keep rotation on element, scale on wrapper
  element.style.transform = "rotate(-45deg)";
  element.style.transition = "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)";
  wrapper.style.transition = "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)";

  element.setAttribute("aria-label", `Marker at ${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`);
  element.tabIndex = 0;

  // Add hover effect - scale the wrapper, not the element to avoid positioning issues
  const handleMouseEnter = () => {
    wrapper.style.transform = "rotate(45deg) scale(1.1)";
  };

  const handleMouseLeave = () => {
    wrapper.style.transform = "rotate(45deg) scale(1)";
  };

  element.addEventListener("mouseenter", handleMouseEnter);
  element.addEventListener("mouseleave", handleMouseLeave);

  const handleClick = (e: MouseEvent) => {
    // Only remove if Cmd (Mac) or Ctrl (Windows/Linux) is held, otherwise allow dragging
    const isModifierPressed = e.metaKey || e.ctrlKey;
    if (isModifierPressed) {
      e.stopPropagation();
      onRemove();
    } else {
      // Prevent map click when clicking on marker (without modifier)
      e.stopPropagation();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      const isModifierPressed = e.metaKey || e.ctrlKey;
      if (isModifierPressed) {
        e.preventDefault();
        e.stopPropagation();
        onRemove();
      }
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      onRemove();
    }
  };

  element.addEventListener("click", handleClick);
  element.addEventListener("keydown", handleKeyDown);

  return {
    element,
    teardown: () => {
      element.removeEventListener("click", handleClick);
      element.removeEventListener("keydown", handleKeyDown);
      element.removeEventListener("mouseenter", handleMouseEnter);
      element.removeEventListener("mouseleave", handleMouseLeave);
    },
  };
}

export function generateMarkerId(): string {
  return `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}


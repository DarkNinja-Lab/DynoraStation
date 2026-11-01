// Local catalogue photographs. Keeping them as individual files lets the browser
// cache and decode only the images that are currently visible in the library.
const trackImageCodes = [
  "5100", "5101", "5102", "5103", "5104", "5105", "5106", "5107", "5108", "5109",
  "5110", "5111", "5112", "5114", "5115", "5116", "5117", "5118", "5119", "5120",
  "5121", "5128", "5129", "5131", "5141", "5142", "5145", "5146", "5147", "5200",
  "5201", "5202", "5203", "5205", "5206", "5207", "5208", "5210", "5211", "5213",
  "5215", "6631", "7039", "7190", "7191"
];

export const trackImages = Object.fromEntries(
  trackImageCodes.map(code => [code, `/assets/track/${code}.jpg?v=workspace-v17`])
);

import * as React from 'react';

interface LogoProps {
  theme: 'light' | 'dark';
  title?: string;
  height?: number;
  width?: number;
}

const defaultWidth = 328;
const defaultHeight = 328;
const ratio = defaultWidth / defaultHeight;

export const EuropaLogo = ({
  theme,
  title = 'DCSN Home',
  height: requestedHeight,
  width: requestedWidth
}: LogoProps) => {
  let height = requestedHeight;
  let width = requestedWidth;

  if (height && width) {
    // Do nothing, we'll assume that's what they want
  } else if (height) {
    // Only height was specified, scale width
    width = ratio * height;
  } else if (width) {
    height = ratio * width;
  } else {
    height = 30;
    width = ratio * height;
  }

  return (
    <svg width={width} height={height} viewBox="92 92 328 328">
      <title>{title}</title>
      <path fill="#BFE4F8" d="M256,139.636c64.163,0,116.364,52.201,116.364,116.364S320.163,372.364,256,372.364
          S139.636,320.163,139.636,256S191.837,139.636,256,139.636 M256,93.091c-89.972,0-162.909,72.937-162.909,162.909
          S166.028,418.909,256,418.909S418.909,345.972,418.909,256S345.972,93.091,256,93.091L256,93.091z"/>
      <circle fill="#4A6478" cx="157.262" cy="157.262" r="23.273" />
      <circle fill="#3C5D76" cx="256" cy="256" r="69.818" />
      <path fill="#1E2E3B" d="M256,186.182c38.561,0,69.818,31.26,69.818,69.818S294.561,325.818,256,325.818" />
      <path fill="#93C7EF" d="M256,93.091v46.545c64.163,0,116.364,52.201,116.364,116.364S320.163,372.364,256,372.364v46.545
          c89.972,0,162.909-72.937,162.909-162.909S345.972,93.091,256,93.091z"/>
    </svg>
  )
}

EuropaLogo.defaultProps = {
  theme: 'dark'
};

export default EuropaLogo;

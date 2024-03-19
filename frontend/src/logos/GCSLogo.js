export function GCSLogo({ width, height, grayscale }) {
  return (
    <svg width={width} height={height} viewBox="0 0 250 250" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip0_1789_6872)">
        <path d="M66.2382 207.781L23.6397 134.102C22.0019 131.27 21.1396 128.056 21.1396 124.785C21.1396 121.515 22.0019 118.301 23.6397 115.469L66.2382 41.7918C67.8762 38.9587 70.2323 36.6062 73.0695 34.9706C75.9067 33.335 79.1252 32.474 82.4013 32.4742H167.598C170.874 32.4743 174.092 33.3354 176.929 34.971C179.766 36.6066 182.122 38.959 183.76 41.7918L226.358 115.469C227.996 118.302 228.859 121.515 228.859 124.786C228.859 128.057 227.996 131.271 226.358 134.104L183.76 207.779C182.122 210.612 179.766 212.964 176.929 214.6C174.092 216.236 170.874 217.097 167.598 217.097H82.4013C79.1251 217.097 75.9067 216.236 73.0694 214.601C70.2321 212.965 67.8761 210.612 66.2382 207.779V207.781Z" fill="url(#paint0_linear_1789_6872)" />
        <path opacity="0.07" d="M101.166 108.379L89.7903 119.706L99.4573 129.361L89.886 146.336L162.32 218.667L179.872 218.67L214.15 157.195L159.872 102.991L101.166 108.379Z" fill="black" />
        <path d="M158.591 102.537H91.3487C90.2663 102.537 89.3818 103.422 89.3818 104.505V118.385C89.3818 119.465 90.2679 120.349 91.3487 120.349H158.591C159.673 120.349 160.559 119.465 160.559 118.385V104.501C160.559 103.422 159.675 102.536 158.593 102.536L158.591 102.537ZM148.181 115.46C147.115 115.457 146.093 115.033 145.34 114.28C144.587 113.527 144.163 112.506 144.161 111.442C144.161 110.915 144.264 110.392 144.466 109.905C144.668 109.418 144.964 108.975 145.337 108.603C145.711 108.23 146.154 107.934 146.642 107.733C147.13 107.531 147.653 107.427 148.181 107.428C150.404 107.428 152.205 109.215 152.205 111.442C152.205 111.969 152.101 112.492 151.899 112.98C151.697 113.467 151.4 113.91 151.027 114.283C150.653 114.657 150.209 114.953 149.721 115.155C149.233 115.357 148.709 115.46 148.181 115.46ZM158.591 129.22L91.3487 129.223C90.2663 129.223 89.3818 130.108 89.3818 131.19V145.069C89.3818 146.149 90.2679 147.035 91.3487 147.035H158.591C159.673 147.035 160.559 146.149 160.559 145.069V131.187C160.559 130.108 159.675 129.22 158.593 129.22H158.591ZM148.181 142.144C147.115 142.142 146.093 141.717 145.34 140.964C144.586 140.211 144.162 139.19 144.161 138.126C144.161 137.598 144.264 137.076 144.466 136.589C144.668 136.102 144.964 135.659 145.337 135.287C145.711 134.914 146.154 134.618 146.642 134.416C147.13 134.215 147.653 134.111 148.181 134.112C148.722 134.09 149.263 134.178 149.77 134.37C150.277 134.562 150.739 134.854 151.13 135.229C151.521 135.604 151.832 136.054 152.045 136.552C152.257 137.05 152.367 137.586 152.367 138.127C152.367 138.669 152.257 139.204 152.045 139.702C151.832 140.2 151.521 140.65 151.13 141.025C150.739 141.4 150.277 141.693 149.77 141.885C149.263 142.077 148.722 142.165 148.181 142.143" fill="white" />
      </g>
      <defs>
        <linearGradient id="paint0_linear_1789_6872" x1="125" y1="32.4759" x2="125" y2="216.81" gradientUnits="userSpaceOnUse">
          <stop stopColor={grayscale ? '#666' : '#4387FD'} />
          <stop offset="1" stopColor={grayscale ? '#999' : '#4683EA'} />
        </linearGradient>
        <clipPath id="clip0_1789_6872">
          <rect width="208" height="187" fill="white" transform="translate(21 32)" />
        </clipPath>
      </defs>
    </svg>
  );
}
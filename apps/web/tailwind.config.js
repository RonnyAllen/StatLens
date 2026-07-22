/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-ui)", "Merriweather", "serif"],
        roboto: ["Roboto", "sans-serif"],
        lato: ["Lato", "sans-serif"],
        "open-sans": ["Open Sans", "sans-serif"],
        "source-sans-3": ["Source Sans 3", "sans-serif"],
        "nunito-sans": ["Nunito Sans", "sans-serif"],
        montserrat: ["Montserrat", "sans-serif"],
        arimo: ["Arimo", "sans-serif"],
        "ibm-plex-sans": ["IBM Plex Sans", "sans-serif"],
        merriweather: ["Merriweather", "serif"],
        "roboto-slab": ["Roboto Slab", "serif"],
        "ibm-plex-serif": ["IBM Plex Serif", "serif"],
        "roboto-mono": ["Roboto Mono", "monospace"],
        "ibm-plex-mono": ["IBM Plex Mono", "monospace"],
        "jetbrains-mono": ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
}

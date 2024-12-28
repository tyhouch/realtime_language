module.exports = {
  plugins: {
    "tailwindcss/nesting": "postcss-nesting",
    tailwindcss: {},
    "postcss-preset-env": {
      stage: 1,
      features: {
        "nesting-rules": false
      }
    }
  }
};

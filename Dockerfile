# Use official Node.js image as the base
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Astro site
RUN npm run build

# Expose the port Astro will run on
EXPOSE 4321

# Start the Vite preview server for correct allowedHosts support
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "4321"]

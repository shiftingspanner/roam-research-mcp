# Use an official Node.js runtime as a parent image for building
FROM node:lts-alpine AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package.json ./
COPY package-lock.json ./

# Install development and production dependencies
RUN --mount=type=cache,target=/root/.npm npm install

# Copy source code, TypeScript configuration, and build-time assets
COPY src /app/src
COPY tsconfig.json /app/tsconfig.json
COPY Roam_Markdown_Cheatsheet.md /app/Roam_Markdown_Cheatsheet.md
COPY .roam /app/.roam

# Build the TypeScript project
RUN npm run build


# Use a minimal Node.js runtime as the base for the release image
FROM node:lts-alpine AS release

# Set environment to production
ENV NODE_ENV=production

# Set the working directory
WORKDIR /app

# Copy built application, dependencies, and runtime assets from builder stage
COPY --from=builder /app/build /app/build
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json
COPY --from=builder /app/Roam_Markdown_Cheatsheet.md /app/Roam_Markdown_Cheatsheet.md

# Install only production dependencies (based on package-lock.json)
# This keeps the final image small and secure by omitting development dependencies
RUN npm ci --ignore-scripts --omit-dev

# Expose the port the app runs on (HTTP Stream)
EXPOSE 8088

# Run the application
ENTRYPOINT ["node", "build/index.js"]

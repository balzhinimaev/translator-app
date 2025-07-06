# Use a lightweight Node.js image
FROM node:lts-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy the pre-built 'dist' directory from the local machine
COPY dist/ ./dist/

# Expose the port the app runs on
EXPOSE 5173

# The command to start the app
CMD [ "npm", "start" ]
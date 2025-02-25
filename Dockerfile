# Use the official Deno image from the Docker Hub
FROM denoland/deno:2.1.2

# Set the working directory
WORKDIR /app

# Copy the project files to the working directory
COPY . .



# Regenerate the lockfile
RUN deno cache --reload --import-map=import_map.json --allow-scripts main.ts
# Expose the port that your Deno application will run on
EXPOSE 8000

# Run the Deno application

CMD ["run","start"]
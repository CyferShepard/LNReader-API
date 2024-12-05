# Use the official Deno image from the Docker Hub
FROM denoland/deno:alpine-1.28.3

# Set the working directory
WORKDIR /app

# Copy the project files to the working directory
COPY . .




# Expose the port that your Deno application will run on
EXPOSE 8000

# Run the Deno application

CMD ["sh", "-c", "deno cache --reload --import-map=import_map.json --allow-scripts .\main.ts && deno run --import-map=import_map.json --allow-net --allow-env --allow-read main.ts"]
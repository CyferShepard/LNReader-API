# Use the official Deno image from the Docker Hub
FROM denoland/deno:2.3.6

# Install dependencies for Chromium (Puppeteer)
USER root
# RUN apt-get update && \
#     apt-get install -y wget gnupg ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 \
#     libatk1.0-0 libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \
#     libxrandr2 xdg-utils --no-install-recommends && \
#     rm -rf /var/lib/apt/lists/*

#RUN apt-get update && apt-get install -y wget gnupg && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && apt-get update && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 --no-install-recommends && rm -rf /var/lib/apt/lists/*


# Set the working directory
WORKDIR /app

# Pre-download the native SQLite library so it doesn't need to be fetched at runtime
# (avoids DNS/network failures on the VPS when the container starts)
ADD https://github.com/denodrivers/sqlite3/releases/download/0.13.0/libsqlite3.so /usr/local/lib/libsqlite3.so

# Tell @db/sqlite to use the pre-downloaded library instead of fetching from GitHub
ENV DENO_SQLITE_LOCAL=/usr/local/lib/libsqlite3.so

# Copy the project files to the working directory
COPY . .

# Regenerate the lockfile
RUN deno cache --reload --allow-scripts main.ts
# Expose the port that your Deno application will run on
EXPOSE 8000

# Run the Deno application

CMD ["run","start"]
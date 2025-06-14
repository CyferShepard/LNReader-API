# Use the official Deno image from the Docker Hub
FROM denoland/deno:2.3.6

# Install dependencies for Chromium (Puppeteer)
USER root
RUN apt-get update && \
    apt-get install -y wget gnupg ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \
    libxrandr2 xdg-utils --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y wget gnupg && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && apt-get update && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 --no-install-recommends && rm -rf /var/lib/apt/lists/*



# Create a new user and set permissions
RUN useradd -ms /bin/bash appuser
WORKDIR /app
COPY . .

# Regenerate the lockfile
RUN deno cache --reload --allow-scripts main.ts
RUN chown -R appuser:appuser /app

# Switch to the new user
USER appuser







# Switch to the new user
USER appuser
# Expose the port that your Deno application will run on
EXPOSE 8000

# Run the Deno application

CMD ["run","start"]
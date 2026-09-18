# MentorTaskFlow SPA — multi-stage build: node (build) → nginx (serve).
# The resulting image weighs ~30 MB and serves the compiled bundle over port 80.

# ---- build stage ------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies first (layer cache: only re-runs when lock file changes).
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build.
COPY . .

# VITE_API_BASE_URL is baked into the bundle at build time.
# In production the SPA and the API live behind the same nginx, so /api/v1 is correct.
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ARG VITE_USE_MOCKS=false
ENV VITE_USE_MOCKS=${VITE_USE_MOCKS}

RUN npm run build

# ---- runtime stage ----------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Remove default site.
RUN rm /etc/nginx/conf.d/default.conf

# Our SPA config — a COPY target, not a bind mount, so it travels with the image.
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Built assets from the previous stage.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

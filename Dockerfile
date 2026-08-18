FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Compile the application into a single binary
RUN bun build src/index.ts --compile --outfile server

# Use a lightweight base image for the final stage
FROM debian:bookworm-slim
WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /app/server .

# Expose the default port
EXPOSE 3000

CMD ["./server"]
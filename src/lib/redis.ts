import { createClient } from "redis";

const client = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number(process.env.REDIS_PORT ?? 6379),
    },
});

client.on("error", (err) => console.error("[redis] Client error:", err));

export async function getRedisClient() {
    if (!client.isOpen) {
        await client.connect();
    }
    return client;
}
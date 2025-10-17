const backendUrl =
	process.env.NEXT_PUBLIC_BACKEND_URL ||
	process.env.BACKEND_URL ||
	"http://localhost:8000"

const normalizedBackendUrl = backendUrl.replace(/\/$/, "")

/** @type {import('next').NextConfig} */
const nextConfig = {
	async rewrites() {
		if (!normalizedBackendUrl) {
			return []
		}

		return [
			{
				source: "/api/:path*",
				destination: `${normalizedBackendUrl}/:path*`,
			},
		]
	},
}

export default nextConfig

"use client";

export function MeshBackground() {
  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: -1 }}
      aria-hidden="true"
    >
      {/* Base color */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--bg-base)" }}
      />

      {/* Blob 1 */}
      <div
        className="absolute rounded-full"
        style={{
          width: "600px",
          height: "600px",
          top: "10%",
          left: "15%",
          background: "var(--bg-mesh-blob-1)",
          filter: "blur(100px)",
          animation: "meshFloat1 20s ease-in-out infinite",
        }}
      />

      {/* Blob 2 */}
      <div
        className="absolute rounded-full"
        style={{
          width: "700px",
          height: "700px",
          top: "40%",
          right: "10%",
          background: "var(--bg-mesh-blob-2)",
          filter: "blur(100px)",
          animation: "meshFloat2 25s ease-in-out infinite",
        }}
      />

      {/* Blob 3 */}
      <div
        className="absolute rounded-full"
        style={{
          width: "550px",
          height: "550px",
          bottom: "10%",
          left: "40%",
          background: "var(--bg-mesh-blob-3)",
          filter: "blur(100px)",
          animation: "meshFloat3 30s ease-in-out infinite",
        }}
      />

      {/* Subtle dot grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(var(--text-primary) 1px, transparent 1px),
            linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
          opacity: 0.03,
        }}
      />
    </div>
  );
}

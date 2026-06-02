export default async function handler(req, res) {
  return res.status(410).json({
    ok: false,
    error: "endpoint_disabled",
    message: "Use /api/send-push para comunicados administrativos."
  });
}

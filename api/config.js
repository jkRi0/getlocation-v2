const { get } = require('@vercel/edge-config');

module.exports = async (req, res) => {
  try {
    const keysParam = typeof req.query?.keys === 'string' ? req.query.keys : '';
    const keys = keysParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const resolvedKeys = keys.length ? keys : ['publicMessage'];

    const entries = await Promise.all(
      resolvedKeys.map(async (key) => {
        const value = await get(key);
        return [key, value];
      })
    );

    res.status(200).json({
      ok: true,
      data: Object.fromEntries(entries),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: 'Failed to read Edge Config',
      details: err && typeof err.message === 'string' ? err.message : String(err),
    });
  }
};

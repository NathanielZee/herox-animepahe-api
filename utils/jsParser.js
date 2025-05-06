function getJsVariable(html, variableName) {
  try {
    const sanitizedName = variableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Improved regex with termination control
    const pattern = new RegExp(
      `(?:let|var|const)\\s+${sanitizedName}\\s*=\\s*` +
      `(["'\`])([^"'\\\\\`]*)(?:\\\\.[^"'\\\\\`]*)*\\1\\s*;`, 
      'm'
    );

    const match = html.match(pattern);
    return match?.[2]?.trim() || null;
  } catch (error) {
    return null;
  }
}


module.exports = { getJsVariable };
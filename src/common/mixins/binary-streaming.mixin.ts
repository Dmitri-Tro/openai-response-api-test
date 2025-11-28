import type { Response as ExpressResponse } from 'express';

/**
 * Stream a binary response from OpenAI to an Express response
 *
 * Handles the piping of a ReadableStream from the OpenAI SDK to the Express response object.
 * Sets appropriate headers for content type and file download.
 *
 * @param response - The Response object from OpenAI SDK (fetch API compatible)
 * @param expressRes - The Express Response object
 * @param contentType - MIME type for the response
 * @param filename - Filename for the Content-Disposition header
 */
export async function streamBinaryResponse(
  response: Response,
  expressRes: ExpressResponse,
  contentType: string,
  filename: string,
): Promise<void> {
  expressRes.setHeader('Content-Type', contentType);
  expressRes.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`,
  );

  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      expressRes.write(value);
    }
  }
  expressRes.end();
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';
import type { Files } from 'openai/resources/files';
import { LoggerService } from '../../common/services/logger.service';

/**
 * Service for interacting with OpenAI Files API
 * Handles file upload, management, and download operations
 */
@Injectable()
export class OpenAIFilesService {
  private client: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
  ) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    const baseURL = this.configService.get<string>('openai.baseUrl');

    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: this.configService.get<number>('openai.timeout'),
      maxRetries: this.configService.get<number>('openai.maxRetries'),
    });
  }

  /**
   * Upload a file to OpenAI
   * @param fileBuffer - File content as Buffer
   * @param filename - Original filename
   * @param purpose - Intended use case for the file
   * @param expiresAfter - Optional expiration policy
   * @returns OpenAI FileObject with metadata
   */
  async uploadFile(
    fileBuffer: Buffer,
    filename: string,
    purpose: Files.FilePurpose,
    expiresAfter?: Files.FileCreateParams['expires_after'],
  ): Promise<Files.FileObject> {
    const startTime = Date.now();

    const params: Files.FileCreateParams = {
      file: await toFile(fileBuffer, filename),
      purpose,
      ...(expiresAfter && { expires_after: expiresAfter }),
    };

    const file: Files.FileObject = await this.client.files.create(params);

    // Log interaction (no data modification)
    this.loggerService.logOpenAIInteraction({
      timestamp: new Date().toISOString(),
      api: 'files',
      endpoint: '/v1/files',
      request: {
        filename,
        purpose,
        bytes: fileBuffer.length,
        expires_after: expiresAfter,
      },
      response: file,
      metadata: {
        latency_ms: Date.now() - startTime,
        file_id: file.id,
        filename: file.filename,
        bytes: file.bytes,
        purpose: file.purpose,
        status: file.status,
        created_at: file.created_at,
      },
    });

    return file; // Return OpenAI response as-is
  }

  /**
   * Retrieve file metadata by ID
   * @param fileId - File ID (starts with "file-")
   * @returns OpenAI FileObject with metadata
   */
  async retrieveFile(fileId: string): Promise<Files.FileObject> {
    return await this.client.files.retrieve(fileId);
  }

  /**
   * List all files with optional filtering
   * @param purpose - Optional filter by purpose
   * @param order - Sort order by created_at: 'asc' or 'desc'
   * @param limit - Number of files to return
   * @returns Array of OpenAI FileObject
   */
  async listFiles(
    purpose?: string,
    order: 'asc' | 'desc' = 'desc',
    limit?: number,
  ): Promise<Files.FileObject[]> {
    const params: Files.FileListParams = {
      ...(purpose && { purpose }),
      ...(order && { order }),
      ...(limit && { limit }),
    };

    const page = await this.client.files.list(params);
    return page.data; // Return data array as-is
  }

  /**
   * Delete file from OpenAI storage
   * @param fileId - File ID to delete
   * @returns OpenAI deletion confirmation response
   */
  async deleteFile(fileId: string): Promise<Files.FileDeleted> {
    return await this.client.files.delete(fileId);
  }

  /**
   * Download file content
   * @param fileId - File ID to download
   * @returns Response object from OpenAI (binary stream)
   * @throws Error if file purpose is 'assistants' (download forbidden)
   */
  async downloadFileContent(fileId: string): Promise<Response> {
    return await this.client.files.content(fileId);
  }

  /**
   * Wait for file processing to complete
   * Uses exponential backoff: 5s → 10s → 15s → 20s (max)
   * @param fileId - File ID to poll
   * @param options - Polling configuration
   * @returns Final OpenAI FileObject (status: 'processed' or 'error')
   * @throws Error if timeout exceeded
   */
  async waitForProcessing(
    fileId: string,
    options?: {
      pollInterval?: number;
      maxWait?: number;
    },
  ): Promise<Files.FileObject> {
    const pollInterval = options?.pollInterval || 5000;
    const maxWait = options?.maxWait || 1800000; // 30 minutes default
    const startTime = Date.now();
    let waitTime = pollInterval;

    while (Date.now() - startTime < maxWait) {
      const file: Files.FileObject = await this.retrieveFile(fileId);

      // Return when processing completes or fails
      if (file.status === 'processed' || file.status === 'error') {
        return file; // Return OpenAI response as-is
      }

      // Wait before next poll (exponential backoff)
      await this.sleep(waitTime);
      waitTime = Math.min(waitTime + 5000, 20000); // Cap at 20 seconds
    }

    // Timeout exceeded
    throw new Error(
      `File processing timeout: exceeded ${maxWait}ms waiting for file ${fileId}`,
    );
  }

  /**
   * Extract file metadata from OpenAI response
   * Helper method to structure data for readability (no computation)
   * @param file - OpenAI FileObject
   * @returns Structured metadata view
   */
  extractFileMetadata(file: Files.FileObject): FileMetadata {
    return {
      id: file.id,
      object: file.object,
      bytes: file.bytes,
      created_at: file.created_at,
      filename: file.filename,
      purpose: file.purpose,
      status: file.status,
      status_details: file.status_details,
      expires_at: file.expires_at,
    };
  }

  /**
   * Sleep helper for polling
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Structured view of OpenAI File metadata
 * Contains only fields from OpenAI response (no computed data)
 */
export interface FileMetadata {
  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  status: 'uploaded' | 'processed' | 'error';
  status_details?: string | null;
  expires_at?: number | null;
}

import {
  Body,
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseFilters,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { Files } from 'openai/resources/files';
import { OpenAIFilesService } from '../services/openai-files.service';

/**
 * Multer file type definition
 * Represents uploaded file from multipart/form-data requests
 */
interface MulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}
import { CreateFileDto } from '../dto/create-file.dto';
import { ListFilesDto } from '../dto/list-files.dto';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { RetryInterceptor } from '../../common/interceptors/retry.interceptor';
import { OpenAIExceptionFilter } from '../../common/filters/openai-exception.filter';

/**
 * Controller for OpenAI Files API
 * Handles file upload, management, and download operations
 */
@ApiTags('Files API')
@Controller('api/files')
@UseInterceptors(RetryInterceptor, LoggingInterceptor)
@UseFilters(OpenAIExceptionFilter)
export class FilesController {
  constructor(private readonly filesService: OpenAIFilesService) {}

  /**
   * Upload file to OpenAI
   * POST /api/files
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload file to OpenAI',
    description:
      'Upload a file for use with OpenAI services. ' +
      'Maximum file size: 512 MB (standard API), 8 GB (Uploads API). ' +
      'Supported formats depend on purpose. ' +
      'Files with purpose="assistants" cannot be downloaded.',
  })
  @ApiBody({
    description: 'File upload with purpose and optional expiration',
    schema: {
      type: 'object',
      required: ['file', 'purpose'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (binary)',
        },
        purpose: {
          type: 'string',
          enum: [
            'assistants',
            'vision',
            'batch',
            'fine-tune',
            'user_data',
            'evals',
          ],
          description: 'Intended use case for the file',
          example: 'assistants',
        },
        expires_after: {
          type: 'object',
          description: 'Optional expiration policy',
          properties: {
            anchor: {
              type: 'string',
              enum: ['created_at'],
              description: 'Timestamp anchor (only "created_at" supported)',
              example: 'created_at',
            },
            seconds: {
              type: 'number',
              minimum: 3600,
              maximum: 2592000,
              description: 'Seconds after anchor before expiration',
              example: 86400,
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid file or parameters' })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 413, description: 'File too large (>512MB)' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async uploadFile(
    @UploadedFile() file: MulterFile,
    @Body() dto: CreateFileDto,
  ): Promise<Files.FileObject> {
    return this.filesService.uploadFile(
      file.buffer,
      file.originalname,
      dto.purpose,
      dto.expires_after,
    );
  }

  /**
   * List all files
   * GET /api/files
   */
  @Get()
  @ApiOperation({
    summary: 'List all files',
    description:
      'Retrieve a list of all uploaded files with optional filtering and sorting. ' +
      'Supports pagination via limit parameter. ' +
      'Default: 20 files, sorted by created_at descending (newest first).',
  })
  @ApiQuery({
    name: 'purpose',
    required: false,
    enum: ['assistants', 'vision', 'batch', 'fine-tune', 'user_data', 'evals'],
    description: 'Filter by file purpose',
    example: 'assistants',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order by created_at (default: desc)',
    example: 'desc',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of files to return (default: 20, max: 10000)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'List of files retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async listFiles(@Query() query: ListFilesDto): Promise<Files.FileObject[]> {
    return this.filesService.listFiles(query.purpose, query.order, query.limit);
  }

  /**
   * Get file metadata
   * GET /api/files/:id
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Retrieve file metadata',
    description:
      'Get detailed metadata for a specific file by ID. ' +
      'Includes: filename, size, purpose, status, creation/expiration timestamps.',
  })
  @ApiParam({
    name: 'id',
    description: 'File ID (starts with "file-")',
    example: 'file-abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'File metadata retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getFile(@Param('id') id: string): Promise<Files.FileObject> {
    return this.filesService.retrieveFile(id);
  }

  /**
   * Download file content
   * GET /api/files/:id/content
   */
  @Get(':id/content')
  @ApiOperation({
    summary: 'Download file content',
    description:
      'Download the contents of a file by ID (binary streaming). ' +
      'IMPORTANT: Files with purpose="assistants" CANNOT be downloaded due to OpenAI policy. ' +
      'All other purposes support download.',
  })
  @ApiParam({
    name: 'id',
    description: 'File ID to download',
    example: 'file-abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'File content downloaded successfully (binary stream)',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing API key',
  })
  @ApiResponse({
    status: 403,
    description: 'Download forbidden (purpose="assistants")',
  })
  @ApiResponse({
    status: 404,
    description: 'File not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async downloadFile(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    // Get file metadata to determine content type
    const fileMetadata = await this.filesService.retrieveFile(id);

    // Download file content
    const response = await this.filesService.downloadFileContent(id);

    // Set content type (attempt to detect from filename, fallback to octet-stream)
    const contentType = this.getContentType(fileMetadata.filename);
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileMetadata.filename}"`,
    );

    // Stream OpenAI response body to client
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  }

  /**
   * Delete file from OpenAI storage
   * DELETE /api/files/:id
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete file from OpenAI storage',
    description:
      'Permanently delete a file from OpenAI storage. ' +
      'This action cannot be undone. ' +
      'Files can be deleted even if used in fine-tuning jobs.',
  })
  @ApiParam({
    name: 'id',
    description: 'File ID to delete',
    example: 'file-abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'File deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async deleteFile(@Param('id') id: string): Promise<Files.FileDeleted> {
    return this.filesService.deleteFile(id);
  }

  /**
   * Determine content type from filename extension
   * @param filename - Original filename
   * @returns MIME type
   */
  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      // Documents
      pdf: 'application/pdf',
      txt: 'text/plain',
      md: 'text/markdown',
      html: 'text/html',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Images
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      // Data
      json: 'application/json',
      jsonl: 'application/jsonl',
      csv: 'text/csv',
      xml: 'application/xml',
      // Code
      js: 'application/javascript',
      ts: 'application/typescript',
      py: 'text/x-python',
      java: 'text/x-java',
      c: 'text/x-c',
      cpp: 'text/x-c++',
    };

    return contentTypeMap[ext || ''] || 'application/octet-stream';
  }
}

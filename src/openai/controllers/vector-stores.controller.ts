import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UseFilters,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { OpenAIExceptionFilter } from '../../common/filters/openai-exception.filter';
import { OpenAIVectorStoresService } from '../services/openai-vector-stores.service';
import { CreateVectorStoreDto } from '../dto/vector-stores/create-vector-store.dto';
import { UpdateVectorStoreDto } from '../dto/vector-stores/update-vector-store.dto';
import { ListVectorStoresDto } from '../dto/vector-stores/list-vector-stores.dto';
import { SearchVectorStoreDto } from '../dto/vector-stores/search-vector-store.dto';
import { AddFileDto } from '../dto/vector-stores/add-file.dto';
import { AddFileBatchDto } from '../dto/vector-stores/add-file-batch.dto';
import { ListVectorStoreFilesDto } from '../dto/vector-stores/list-vector-store-files.dto';
import type { VectorStores } from 'openai/resources/vector-stores';

/**
 * Controller for OpenAI Vector Stores API
 *
 * Provides RESTful endpoints for semantic search over uploaded files.
 * Essential for RAG (Retrieval-Augmented Generation) workflows.
 *
 * **Endpoints:**
 * - Vector Store Management: 6 endpoints (create, retrieve, update, list, delete, search)
 * - File Operations: 6 endpoints (add, list, get, update, remove, content)
 * - Batch Operations: 4 endpoints (create, get, cancel, listFiles)
 * - Polling: 2 endpoints (pollVectorStore, pollFile)
 *
 * **Integration:**
 * - Phase 4 (Files API): Upload files before adding to vector store
 * - Phase 2.14 (file_search tool): Use vector_store_ids in Responses API
 *
 * @see {@link https://platform.openai.com/docs/api-reference/vector-stores}
 */
@ApiTags('Vector Stores API')
@Controller('api/vector-stores')
@UseInterceptors(LoggingInterceptor)
@UseFilters(OpenAIExceptionFilter)
export class VectorStoresController {
  constructor(
    private readonly vectorStoresService: OpenAIVectorStoresService,
  ) {}

  // ============================================================
  // VECTOR STORE MANAGEMENT (6 endpoints)
  // ============================================================

  /**
   * POST /api/vector-stores
   * Create a new vector store
   */
  @Post()
  @ApiOperation({
    summary: 'Create a vector store',
    description: 'Create a new vector store for semantic search over files',
  })
  @ApiResponse({
    status: 201,
    description: 'Vector store created successfully',
  })
  async createVectorStore(
    @Body() dto: CreateVectorStoreDto,
  ): Promise<VectorStores.VectorStore> {
    return await this.vectorStoresService.createVectorStore(dto);
  }

  /**
   * GET /api/vector-stores/:vectorStoreId
   * Retrieve a vector store by ID
   */
  @Get(':vectorStoreId')
  @ApiOperation({
    summary: 'Retrieve a vector store',
    description: 'Get details of a specific vector store by ID',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID (starts with "vs_")',
    example: 'vs_abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'Vector store retrieved successfully',
  })
  async retrieveVectorStore(
    @Param('vectorStoreId') vectorStoreId: string,
  ): Promise<VectorStores.VectorStore> {
    return await this.vectorStoresService.retrieveVectorStore(vectorStoreId);
  }

  /**
   * PATCH /api/vector-stores/:vectorStoreId
   * Update a vector store
   */
  @Patch(':vectorStoreId')
  @ApiOperation({
    summary: 'Update a vector store',
    description: 'Update vector store name, expiration, or metadata',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'Vector store updated successfully',
  })
  async updateVectorStore(
    @Param('vectorStoreId') vectorStoreId: string,
    @Body() dto: UpdateVectorStoreDto,
  ): Promise<VectorStores.VectorStore> {
    return await this.vectorStoresService.updateVectorStore(vectorStoreId, dto);
  }

  /**
   * GET /api/vector-stores
   * List vector stores with pagination
   */
  @Get()
  @ApiOperation({
    summary: 'List vector stores',
    description: 'List all vector stores with cursor-based pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Vector stores retrieved successfully',
  })
  async listVectorStores(
    @Query() dto?: ListVectorStoresDto,
  ): Promise<VectorStores.VectorStore[]> {
    return await this.vectorStoresService.listVectorStores(dto);
  }

  /**
   * DELETE /api/vector-stores/:vectorStoreId
   * Delete a vector store
   */
  @Delete(':vectorStoreId')
  @ApiOperation({
    summary: 'Delete a vector store',
    description:
      'Permanently delete a vector store and all its file associations',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'Vector store deleted successfully',
  })
  async deleteVectorStore(
    @Param('vectorStoreId') vectorStoreId: string,
  ): Promise<VectorStores.VectorStoreDeleted> {
    return await this.vectorStoresService.deleteVectorStore(vectorStoreId);
  }

  /**
   * POST /api/vector-stores/:vectorStoreId/search
   * Search a vector store
   */
  @Post(':vectorStoreId/search')
  @ApiOperation({
    summary: 'Search a vector store',
    description: 'Perform semantic search over files in a vector store',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
  })
  async searchVectorStore(
    @Param('vectorStoreId') vectorStoreId: string,
    @Body() dto: SearchVectorStoreDto,
  ): Promise<VectorStores.VectorStoreSearchResponse[]> {
    return await this.vectorStoresService.searchVectorStore(vectorStoreId, dto);
  }

  // ============================================================
  // FILE OPERATIONS (6 endpoints)
  // ============================================================

  /**
   * POST /api/vector-stores/:vectorStoreId/files
   * Add a file to a vector store
   */
  @Post(':vectorStoreId/files')
  @ApiOperation({
    summary: 'Add a file to vector store',
    description:
      'Attach a previously uploaded file to a vector store for indexing',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiResponse({
    status: 201,
    description: 'File added successfully (status: in_progress)',
  })
  async addFile(
    @Param('vectorStoreId') vectorStoreId: string,
    @Body() dto: AddFileDto,
  ): Promise<VectorStores.VectorStoreFile> {
    return await this.vectorStoresService.addFile(vectorStoreId, dto);
  }

  /**
   * GET /api/vector-stores/:vectorStoreId/files
   * List files in a vector store
   */
  @Get(':vectorStoreId/files')
  @ApiOperation({
    summary: 'List vector store files',
    description:
      'List all files in a vector store with pagination and filtering',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'Files retrieved successfully',
  })
  async listFiles(
    @Param('vectorStoreId') vectorStoreId: string,
    @Query() dto?: ListVectorStoreFilesDto,
  ): Promise<VectorStores.VectorStoreFile[]> {
    return await this.vectorStoresService.listFiles(vectorStoreId, dto);
  }

  /**
   * GET /api/vector-stores/:vectorStoreId/files/:fileId
   * Get a file from a vector store
   */
  @Get(':vectorStoreId/files/:fileId')
  @ApiOperation({
    summary: 'Get vector store file',
    description: 'Retrieve details of a specific file in a vector store',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiParam({
    name: 'fileId',
    description: 'File ID',
    example: 'file-abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'File retrieved successfully',
  })
  async getFile(
    @Param('vectorStoreId') vectorStoreId: string,
    @Param('fileId') fileId: string,
  ): Promise<VectorStores.VectorStoreFile> {
    return await this.vectorStoresService.getFile(vectorStoreId, fileId);
  }

  /**
   * PATCH /api/vector-stores/:vectorStoreId/files/:fileId
   * Update file attributes
   */
  @Patch(':vectorStoreId/files/:fileId')
  @ApiOperation({
    summary: 'Update file attributes',
    description: 'Update custom attributes for a file in a vector store',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiParam({
    name: 'fileId',
    description: 'File ID',
    example: 'file-abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'File attributes updated successfully',
  })
  async updateFile(
    @Param('vectorStoreId') vectorStoreId: string,
    @Param('fileId') fileId: string,
    @Body('attributes')
    attributes: Record<string, string | number | boolean> | null,
  ): Promise<VectorStores.VectorStoreFile> {
    return await this.vectorStoresService.updateFile(
      vectorStoreId,
      fileId,
      attributes,
    );
  }

  /**
   * DELETE /api/vector-stores/:vectorStoreId/files/:fileId
   * Remove a file from a vector store
   */
  @Delete(':vectorStoreId/files/:fileId')
  @ApiOperation({
    summary: 'Remove file from vector store',
    description:
      'Remove a file association from vector store (file itself not deleted)',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiParam({
    name: 'fileId',
    description: 'File ID',
    example: 'file-abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'File removed successfully',
  })
  async removeFile(
    @Param('vectorStoreId') vectorStoreId: string,
    @Param('fileId') fileId: string,
  ): Promise<VectorStores.VectorStoreFileDeleted> {
    return await this.vectorStoresService.removeFile(vectorStoreId, fileId);
  }

  /**
   * GET /api/vector-stores/:vectorStoreId/files/:fileId/content
   * Get file content from a vector store
   */
  @Get(':vectorStoreId/files/:fileId/content')
  @ApiOperation({
    summary: 'Get file content',
    description: 'Retrieve parsed content chunks from a vector store file',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiParam({
    name: 'fileId',
    description: 'File ID',
    example: 'file-abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'File content retrieved successfully',
  })
  async getFileContent(
    @Param('vectorStoreId') vectorStoreId: string,
    @Param('fileId') fileId: string,
  ): Promise<VectorStores.FileContentResponse[]> {
    return await this.vectorStoresService.getFileContent(vectorStoreId, fileId);
  }

  // ============================================================
  // BATCH OPERATIONS (4 endpoints)
  // ============================================================

  /**
   * POST /api/vector-stores/:vectorStoreId/file-batches
   * Create a file batch operation
   */
  @Post(':vectorStoreId/file-batches')
  @ApiOperation({
    summary: 'Create file batch',
    description:
      'Add multiple files to a vector store in a single batch operation',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiResponse({
    status: 201,
    description: 'File batch created successfully (status: in_progress)',
  })
  async createFileBatch(
    @Param('vectorStoreId') vectorStoreId: string,
    @Body() dto: AddFileBatchDto,
  ): Promise<VectorStores.VectorStoreFileBatch> {
    return await this.vectorStoresService.createFileBatch(vectorStoreId, dto);
  }

  /**
   * GET /api/vector-stores/:vectorStoreId/file-batches/:batchId
   * Get a file batch
   */
  @Get(':vectorStoreId/file-batches/:batchId')
  @ApiOperation({
    summary: 'Get file batch',
    description: 'Retrieve details of a specific file batch operation',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiParam({
    name: 'batchId',
    description: 'Batch ID',
    example: 'vsfb_abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'File batch retrieved successfully',
  })
  async getFileBatch(
    @Param('vectorStoreId') vectorStoreId: string,
    @Param('batchId') batchId: string,
  ): Promise<VectorStores.VectorStoreFileBatch> {
    return await this.vectorStoresService.getFileBatch(vectorStoreId, batchId);
  }

  /**
   * POST /api/vector-stores/:vectorStoreId/file-batches/:batchId/cancel
   * Cancel a file batch operation
   */
  @Post(':vectorStoreId/file-batches/:batchId/cancel')
  @ApiOperation({
    summary: 'Cancel file batch',
    description: 'Cancel an in-progress file batch operation',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiParam({
    name: 'batchId',
    description: 'Batch ID',
    example: 'vsfb_abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'File batch cancelled successfully',
  })
  async cancelFileBatch(
    @Param('vectorStoreId') vectorStoreId: string,
    @Param('batchId') batchId: string,
  ): Promise<VectorStores.VectorStoreFileBatch> {
    return await this.vectorStoresService.cancelFileBatch(
      vectorStoreId,
      batchId,
    );
  }

  /**
   * GET /api/vector-stores/:vectorStoreId/file-batches/:batchId/files
   * List files in a batch
   */
  @Get(':vectorStoreId/file-batches/:batchId/files')
  @ApiOperation({
    summary: 'List batch files',
    description: 'List all files in a specific batch operation',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiParam({
    name: 'batchId',
    description: 'Batch ID',
    example: 'vsfb_abc123xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'Batch files retrieved successfully',
  })
  async listBatchFiles(
    @Param('vectorStoreId') vectorStoreId: string,
    @Param('batchId') batchId: string,
    @Query() dto?: ListVectorStoreFilesDto,
  ): Promise<VectorStores.VectorStoreFile[]> {
    return await this.vectorStoresService.listBatchFiles(
      vectorStoreId,
      batchId,
      dto,
    );
  }

  // ============================================================
  // POLLING ENDPOINTS (2 endpoints)
  // ============================================================

  /**
   * POST /api/vector-stores/:vectorStoreId/poll
   * Poll until vector store indexing completes
   */
  @Post(':vectorStoreId/poll')
  @ApiOperation({
    summary: 'Poll vector store',
    description: 'Wait for vector store indexing to complete (max 10 minutes)',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiQuery({
    name: 'max_wait_ms',
    required: false,
    description:
      'Maximum wait time in milliseconds (default: 30000, max: 600000)',
    example: 30000,
  })
  @ApiResponse({
    status: 200,
    description: 'Vector store completed successfully',
  })
  async pollVectorStore(
    @Param('vectorStoreId') vectorStoreId: string,
    @Query('max_wait_ms') maxWaitMs?: number,
  ): Promise<VectorStores.VectorStore> {
    return await this.vectorStoresService.pollUntilComplete(
      vectorStoreId,
      maxWaitMs || 30000,
    );
  }

  /**
   * POST /api/vector-stores/:vectorStoreId/files/:fileId/poll
   * Poll until file indexing completes
   */
  @Post(':vectorStoreId/files/:fileId/poll')
  @ApiOperation({
    summary: 'Poll file indexing',
    description: 'Wait for file indexing to complete (max 10 minutes)',
  })
  @ApiParam({
    name: 'vectorStoreId',
    description: 'Vector store ID',
    example: 'vs_abc123xyz789',
  })
  @ApiParam({
    name: 'fileId',
    description: 'File ID',
    example: 'file-abc123xyz789',
  })
  @ApiQuery({
    name: 'max_wait_ms',
    required: false,
    description:
      'Maximum wait time in milliseconds (default: 30000, max: 600000)',
    example: 30000,
  })
  @ApiResponse({
    status: 200,
    description: 'File indexing completed successfully',
  })
  async pollFile(
    @Param('vectorStoreId') vectorStoreId: string,
    @Param('fileId') fileId: string,
    @Query('max_wait_ms') maxWaitMs?: number,
  ): Promise<VectorStores.VectorStoreFile> {
    return await this.vectorStoresService.pollFileUntilComplete(
      vectorStoreId,
      fileId,
      maxWaitMs || 30000,
    );
  }
}

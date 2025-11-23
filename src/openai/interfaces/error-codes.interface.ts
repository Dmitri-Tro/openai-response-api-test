/**
 * Error code type definitions for OpenAI Responses API
 * Enhanced Error Handling
 */

/**
 * OpenAI API error types (from SDK)
 */
export type OpenAIErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'rate_limit_error'
  | 'api_error'
  | 'server_error'
  | 'service_unavailable';

/**
 * Image-specific error codes
 */
export type ImageErrorCode =
  // Vector Store Errors
  | 'vector_store_timeout'
  // Generic Image Errors
  | 'invalid_image'
  | 'invalid_image_format'
  | 'invalid_base64_image'
  | 'invalid_image_url'
  | 'image_parse_error'
  | 'invalid_image_mode'
  | 'unsupported_image_media_type'
  // Image Size Errors
  | 'image_too_large'
  | 'image_too_small'
  | 'image_file_too_large'
  | 'empty_image_file'
  // Image Content Errors
  | 'image_content_policy_violation'
  // Image Download Errors
  | 'failed_to_download_image'
  | 'image_file_not_found';

/**
 * File-specific error codes
 */
export type FileErrorCode =
  // File Upload Errors
  | 'file_too_large'
  | 'file_upload_failed'
  | 'invalid_file_format'
  | 'unsupported_file'
  | 'content_size_limit'
  // File Processing Errors
  | 'processing_failed'
  | 'file_parsing_error'
  | 'invalid_file_content'
  // File Access Errors
  | 'file_not_found'
  | 'download_forbidden'
  | 'file_deleted'
  // File Purpose Errors
  | 'invalid_purpose'
  | 'purpose_mismatch';

/**
 * Vector Store-specific error codes
 */
export type VectorStoreErrorCode =
  // Vector Store Lifecycle Errors
  | 'vector_store_not_found'
  | 'vector_store_expired'
  | 'vector_store_limit_exceeded'
  | 'vector_store_creation_failed'
  | 'vector_store_deletion_failed'
  // Vector Store File Errors
  | 'file_already_attached'
  | 'file_not_in_vector_store'
  | 'file_indexing_failed'
  | 'file_indexing_timeout'
  | 'invalid_chunking_strategy'
  | 'chunk_size_invalid'
  | 'chunk_overlap_invalid'
  // Vector Store Batch Errors
  | 'batch_not_found'
  | 'batch_too_large'
  | 'batch_processing_failed'
  | 'batch_cancelled'
  // Vector Store Search Errors
  | 'search_failed'
  | 'invalid_search_query'
  | 'invalid_search_filter'
  | 'ranking_failed'
  // Vector Store Metadata Errors
  | 'metadata_too_large'
  | 'metadata_key_too_long'
  | 'metadata_value_too_long';

/**
 * Images API-specific error codes (DALL-E 2/3)
 * Phase 5: Standalone Images API
 */
export type ImagesAPIErrorCode =
  // Generation Errors
  | 'invalid_image_prompt'
  | 'image_generation_failed'
  | 'model_not_available'
  | 'quota_exceeded'
  // Edit/Variation Errors
  | 'invalid_image_dimensions'
  | 'mask_dimensions_mismatch'
  | 'mask_not_provided'
  | 'operation_not_supported'
  | 'invalid_image_file'
  // Quality/Size Errors
  | 'invalid_image_size'
  | 'invalid_quality_setting'
  | 'size_quality_incompatible';

/**
 * Videos API-specific error codes
 * Phase 3: Videos API
 */
export type VideoErrorCode =
  // Video Generation Errors
  | 'video_generation_failed'
  | 'invalid_video_prompt'
  | 'video_generation_timeout'
  | 'video_model_not_available'
  | 'video_quota_exceeded'
  // Video File Errors
  | 'video_file_not_found'
  | 'video_download_failed'
  | 'video_processing_failed'
  | 'invalid_video_parameters'
  // Remix Errors
  | 'remix_not_supported'
  | 'invalid_remix_parameters'
  | 'remix_failed'
  // Resource Errors
  | 'video_limit_exceeded'
  | 'remix_limit_exceeded'
  | 'invalid_video_duration'
  // Additional Errors
  | 'invalid_video_size'
  | 'video_content_policy_violation'
  | 'video_expired';

/**
 * Network error codes (Node.js)
 */
export type NetworkErrorCode =
  | 'ECONNREFUSED'
  | 'ETIMEDOUT'
  | 'ECONNRESET'
  | 'ENOTFOUND'
  | 'EHOSTUNREACH';

/**
 * OpenAI API-specific error codes (not image-related)
 */
export type OpenAIAPIErrorCode =
  | 'rate_limit_error'
  | 'authentication_error'
  | 'invalid_request_error'
  | 'server_error'
  | 'api_error'
  | 'permission_denied_error'
  | 'not_found_error'
  | 'timeout_error';

/**
 * All supported error codes
 */
export type ErrorCode =
  | ImageErrorCode
  | FileErrorCode
  | VectorStoreErrorCode
  | ImagesAPIErrorCode
  | VideoErrorCode
  | NetworkErrorCode
  | OpenAIAPIErrorCode;

/**
 * Rate limit information from OpenAI response headers
 */
export interface RateLimitInfo {
  limit_requests?: string | number;
  remaining_requests?: string | number;
  reset_requests?: string | number;
  limit_tokens?: string | number;
  remaining_tokens?: string | number;
  reset_tokens?: string | number;
}

/**
 * Enhanced error response structure
 */
export interface EnhancedErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  request_id?: string;
  error_code?: ErrorCode;
  parameter?: string | null;
  hint?: string;
  rate_limit_info?: RateLimitInfo;
  retry_after_seconds?: number | string;
  openai_error?: {
    type: string;
    code?: string;
    param?: string | null;
    message: string;
    full_error?: unknown;
  };
  error?: unknown;
  details?: string;
  full_error?: {
    message: string;
    name?: string;
    stack?: string;
  };
}

/**
 * Mapping of image error codes to HTTP status codes and user-friendly messages
 */
export const IMAGE_ERROR_CODE_MAPPINGS: Record<
  ImageErrorCode,
  {
    status: number;
    message: string;
    hint: string;
  }
> = {
  // Vector Store Errors
  vector_store_timeout: {
    status: 504,
    message: 'File search operation timed out',
    hint: 'The vector store search took too long. Try reducing the search scope or simplifying your query.',
  },

  // Generic Image Errors
  invalid_image: {
    status: 400,
    message: 'Invalid image provided',
    hint: 'The image failed validation. Ensure it is a valid image file in a supported format (PNG, JPEG, WebP).',
  },
  invalid_image_format: {
    status: 400,
    message: 'Unsupported image format',
    hint: 'Only PNG, JPEG, or WebP formats are supported. Convert your image to one of these formats.',
  },
  invalid_base64_image: {
    status: 400,
    message: 'Malformed base64-encoded image',
    hint: 'The base64 image data is invalid. Verify the encoding is correct and complete.',
  },
  invalid_image_url: {
    status: 400,
    message: 'Invalid image URL',
    hint: 'The image URL is malformed or inaccessible. Ensure it is a valid HTTP/HTTPS URL.',
  },
  image_parse_error: {
    status: 400,
    message: 'Unable to parse image file',
    hint: 'The image file is corrupted or in an unrecognized format. Try re-saving or converting the image.',
  },
  invalid_image_mode: {
    status: 400,
    message: 'Unsupported image mode',
    hint: 'The image color mode is not supported. Convert to RGB or RGBA mode.',
  },
  unsupported_image_media_type: {
    status: 400,
    message: 'Unsupported image MIME type',
    hint: 'The image MIME type is not supported. Use image/png, image/jpeg, or image/webp.',
  },

  // Image Size Errors
  image_too_large: {
    status: 400,
    message: 'Image exceeds maximum size limit',
    hint: 'Maximum image size is 20MB. Resize or compress your image before uploading.',
  },
  image_too_small: {
    status: 400,
    message: 'Image is below minimum size requirements',
    hint: 'The image dimensions are too small. Ensure minimum dimensions are met for your use case.',
  },
  image_file_too_large: {
    status: 400,
    message: 'Image file size exceeds limit',
    hint: 'The image file is too large. Compress the file or reduce its dimensions.',
  },
  empty_image_file: {
    status: 400,
    message: 'Empty image file provided',
    hint: 'The image file is empty (0 bytes). Provide a valid image file.',
  },

  // Image Content Errors
  image_content_policy_violation: {
    status: 400,
    message: 'Image violates content policy',
    hint: 'The image contains content that violates OpenAI usage policies. Review and modify the image.',
  },

  // Image Download Errors
  failed_to_download_image: {
    status: 502,
    message: 'Failed to download image from URL',
    hint: 'Unable to download the image. Verify the URL is accessible and not behind authentication or firewall.',
  },
  image_file_not_found: {
    status: 404,
    message: 'Image file not found at URL',
    hint: 'The image URL returned 404. Verify the URL is correct and the resource exists.',
  },
};

/**
 * Mapping of network error codes to HTTP status codes and messages
 */
export const NETWORK_ERROR_CODE_MAPPINGS: Record<
  NetworkErrorCode,
  {
    status: number;
    message: string;
    hint: string;
  }
> = {
  ECONNREFUSED: {
    status: 503,
    message: 'Cannot connect to OpenAI API',
    hint: 'Connection refused. Verify your network connection and that OpenAI services are accessible.',
  },
  ETIMEDOUT: {
    status: 504,
    message: 'Request to OpenAI API timed out',
    hint: 'The request exceeded the timeout limit. Try again or increase the timeout setting.',
  },
  ECONNRESET: {
    status: 504,
    message: 'Connection to OpenAI API was reset',
    hint: 'The connection was interrupted. This is usually temporary; retry with exponential backoff.',
  },
  ENOTFOUND: {
    status: 503,
    message: 'Cannot resolve OpenAI API hostname',
    hint: 'DNS resolution failed. Check your network connection and DNS settings.',
  },
  EHOSTUNREACH: {
    status: 503,
    message: 'OpenAI API host unreachable',
    hint: 'Cannot reach the OpenAI API. Check your network connection and firewall settings.',
  },
};

/**
 * Mapping of file error codes to HTTP status codes and user-friendly messages
 */
export const FILE_ERROR_CODE_MAPPINGS: Record<
  FileErrorCode,
  {
    status: number;
    message: string;
    hint: string;
  }
> = {
  // File Upload Errors
  file_too_large: {
    status: 413,
    message: 'File exceeds maximum size limit',
    hint: 'File must be under 512 MB for standard API. Use Uploads API for files up to 8 GB, or reduce file size.',
  },
  file_upload_failed: {
    status: 500,
    message: 'File upload failed',
    hint: 'The file upload encountered an error. Retry the upload or check file integrity and format.',
  },
  invalid_file_format: {
    status: 400,
    message: 'Unsupported file format',
    hint: 'The file format is not supported for this purpose. Check supported formats in the documentation.',
  },
  unsupported_file: {
    status: 400,
    message: 'File type not supported',
    hint: 'The file extension or MIME type is not supported. Convert to a supported format.',
  },
  content_size_limit: {
    status: 400,
    message: 'Content exceeds size limit',
    hint: 'The file content is too large. Split into smaller files or reduce content size.',
  },

  // File Processing Errors
  processing_failed: {
    status: 400,
    message: 'File processing failed',
    hint: 'OpenAI could not process the file. Check status_details for specific errors or verify file format.',
  },
  file_parsing_error: {
    status: 400,
    message: 'Unable to parse file',
    hint: 'The file structure is invalid or corrupted. Verify file format and content integrity.',
  },
  invalid_file_content: {
    status: 400,
    message: 'File contains invalid content',
    hint: 'The file content does not match format requirements. Review format specifications for your purpose.',
  },

  // File Access Errors
  file_not_found: {
    status: 404,
    message: 'File not found',
    hint: 'The file ID does not exist or has been deleted. Verify the file ID is correct.',
  },
  download_forbidden: {
    status: 403,
    message: 'File download not allowed',
    hint: 'Files with purpose "assistants" cannot be downloaded via API due to OpenAI policy restrictions.',
  },
  file_deleted: {
    status: 410,
    message: 'File has been deleted',
    hint: 'The file was previously deleted and is no longer available.',
  },

  // File Purpose Errors
  invalid_purpose: {
    status: 400,
    message: 'Invalid file purpose',
    hint: 'Purpose must be one of: assistants, vision, batch, fine-tune, user_data, evals.',
  },
  purpose_mismatch: {
    status: 400,
    message: 'File purpose does not match operation',
    hint: 'The file purpose is not compatible with the requested operation. Use files with appropriate purpose.',
  },
};

/**
 * Mapping of vector store error codes to HTTP status codes and user-friendly messages
 */
export const VECTOR_STORE_ERROR_CODE_MAPPINGS: Record<
  VectorStoreErrorCode,
  {
    status: number;
    message: string;
    hint: string;
  }
> = {
  // Vector Store Lifecycle Errors
  vector_store_not_found: {
    status: 404,
    message: 'Vector store not found',
    hint: 'The vector store ID does not exist or has been deleted. Verify the ID is correct.',
  },
  vector_store_expired: {
    status: 410,
    message: 'Vector store has expired',
    hint: 'The vector store expired based on its expiration policy. Create a new vector store.',
  },
  vector_store_limit_exceeded: {
    status: 429,
    message: 'Vector store limit exceeded',
    hint: 'You have reached the maximum number of vector stores for your account. Delete unused stores or upgrade.',
  },
  vector_store_creation_failed: {
    status: 500,
    message: 'Failed to create vector store',
    hint: 'Vector store creation failed. Retry the operation or contact support if the issue persists.',
  },
  vector_store_deletion_failed: {
    status: 500,
    message: 'Failed to delete vector store',
    hint: 'Vector store deletion failed. Retry the operation or contact support if the issue persists.',
  },

  // Vector Store File Errors
  file_already_attached: {
    status: 409,
    message: 'File already attached to vector store',
    hint: 'This file is already part of the vector store. Each file can only be attached once.',
  },
  file_not_in_vector_store: {
    status: 404,
    message: 'File not found in vector store',
    hint: 'The file ID does not exist in this vector store. Verify the file ID and vector store ID.',
  },
  file_indexing_failed: {
    status: 400,
    message: 'File indexing failed',
    hint: 'The file could not be indexed. Check file.last_error for details or verify file format compatibility.',
  },
  file_indexing_timeout: {
    status: 504,
    message: 'File indexing timed out',
    hint: 'File indexing exceeded the time limit. Large files may require more time; use polling to check status.',
  },
  invalid_chunking_strategy: {
    status: 400,
    message: 'Invalid chunking strategy',
    hint: 'Chunking strategy must be "auto" or "static" with valid parameters.',
  },
  chunk_size_invalid: {
    status: 400,
    message: 'Chunk size out of valid range',
    hint: 'max_chunk_size_tokens must be between 100 and 4096.',
  },
  chunk_overlap_invalid: {
    status: 400,
    message: 'Chunk overlap exceeds limit',
    hint: 'chunk_overlap_tokens cannot exceed half of max_chunk_size_tokens.',
  },

  // Vector Store Batch Errors
  batch_not_found: {
    status: 404,
    message: 'File batch not found',
    hint: 'The batch ID does not exist in this vector store. Verify the batch ID and vector store ID.',
  },
  batch_too_large: {
    status: 400,
    message: 'Batch exceeds maximum file limit',
    hint: 'Batch operations are limited to 500 files. Split into multiple batches.',
  },
  batch_processing_failed: {
    status: 400,
    message: 'Batch processing failed',
    hint: 'The batch operation encountered errors. Check batch.file_counts for details on failed files.',
  },
  batch_cancelled: {
    status: 409,
    message: 'Batch has been cancelled',
    hint: 'The batch operation was cancelled and cannot be resumed. Create a new batch if needed.',
  },

  // Vector Store Search Errors
  search_failed: {
    status: 500,
    message: 'Vector store search failed',
    hint: 'The search operation encountered an error. Retry or simplify the search query.',
  },
  invalid_search_query: {
    status: 400,
    message: 'Invalid search query',
    hint: 'The search query format is invalid. Provide a valid string or array of strings.',
  },
  invalid_search_filter: {
    status: 400,
    message: 'Invalid search filter',
    hint: 'The search filter format is invalid. Use comparison filters (eq, ne, gt, etc.) or compound filters (and, or).',
  },
  ranking_failed: {
    status: 500,
    message: 'Search ranking failed',
    hint: 'The ranking operation failed. Retry without ranking_options or adjust score_threshold.',
  },

  // Vector Store Metadata Errors
  metadata_too_large: {
    status: 400,
    message: 'Metadata exceeds maximum limit',
    hint: 'Metadata is limited to 16 key-value pairs. Remove unnecessary metadata entries.',
  },
  metadata_key_too_long: {
    status: 400,
    message: 'Metadata key exceeds maximum length',
    hint: 'Metadata keys must be 64 characters or less. Shorten the key name.',
  },
  metadata_value_too_long: {
    status: 400,
    message: 'Metadata value exceeds maximum length',
    hint: 'Metadata values must be 512 characters or less. Shorten the value or store large data elsewhere.',
  },
};

/**
 * Mapping of Images API error codes to HTTP status codes and user-friendly messages
 * Phase 5: Standalone Images API (DALL-E 2/3)
 */
export const IMAGES_API_ERROR_CODE_MAPPINGS: Record<
  ImagesAPIErrorCode,
  {
    status: number;
    message: string;
    hint: string;
  }
> = {
  // Generation Errors
  invalid_image_prompt: {
    status: 400,
    message: 'Image prompt violates content policy',
    hint: 'The prompt contains content that violates OpenAI usage policies. Modify the prompt to comply with guidelines.',
  },
  image_generation_failed: {
    status: 500,
    message: 'Image generation failed',
    hint: 'Internal error during image generation. Retry the request or contact support if the issue persists.',
  },
  model_not_available: {
    status: 404,
    message: 'Image model not found or unavailable',
    hint: 'The specified model does not exist or is not available. Use "dall-e-2" or "dall-e-3".',
  },
  quota_exceeded: {
    status: 429,
    message: 'Image generation quota exceeded',
    hint: 'You have exceeded your image generation quota for this billing period. Upgrade your plan or wait for quota reset.',
  },

  // Edit/Variation Errors
  invalid_image_dimensions: {
    status: 400,
    message: 'Image dimensions are invalid',
    hint: 'Images for edits and variations must be square (same width and height). Resize your image to square dimensions.',
  },
  mask_dimensions_mismatch: {
    status: 400,
    message: 'Mask dimensions do not match image',
    hint: 'The mask must have exactly the same dimensions as the source image. Resize the mask to match.',
  },
  mask_not_provided: {
    status: 400,
    message: 'Mask required for this operation',
    hint: 'This edit operation requires a mask image. Provide a PNG mask with transparent areas indicating edit regions.',
  },
  operation_not_supported: {
    status: 400,
    message: 'Operation not supported for this model',
    hint: 'DALL-E 3 does not support edits or variations. Use DALL-E 2 for these operations, or use gpt-image-1 via Responses API.',
  },
  invalid_image_file: {
    status: 400,
    message: 'Invalid or corrupted image file',
    hint: 'The image file is corrupted or in an unsupported format. Ensure it is a valid PNG, JPEG, or WEBP file less than 4MB.',
  },

  // Quality/Size Errors
  invalid_image_size: {
    status: 400,
    message: 'Invalid image size for model',
    hint: 'DALL-E 3 supports 1024x1024, 1792x1024, 1024x1792. DALL-E 2 supports 256x256, 512x512, 1024x1024.',
  },
  invalid_quality_setting: {
    status: 400,
    message: 'Invalid quality setting for model',
    hint: 'DALL-E 3 supports "standard" and "hd" quality. DALL-E 2 only supports "standard" quality.',
  },
  size_quality_incompatible: {
    status: 400,
    message: 'Size and quality combination not supported',
    hint: 'HD quality for 1792x1024 and 1024x1792 sizes is only available with DALL-E 3.',
  },
};

/**
 * Mapping of Videos API error codes to HTTP status codes and user-friendly messages
 * Phase 3: Videos API
 */
export const VIDEO_ERROR_CODE_MAPPINGS: Record<
  VideoErrorCode,
  {
    status: number;
    message: string;
    hint: string;
  }
> = {
  // Video Generation Errors
  video_generation_failed: {
    status: 500,
    message: 'Video generation failed',
    hint: 'Internal error during video generation. Retry the request or contact support if the issue persists.',
  },
  invalid_video_prompt: {
    status: 400,
    message: 'Video prompt violates content policy',
    hint: 'The prompt contains content that violates OpenAI usage policies. Modify the prompt to comply with guidelines.',
  },
  video_generation_timeout: {
    status: 504,
    message: 'Video generation timed out',
    hint: 'Video generation exceeded the maximum time limit (typically 10 minutes). Simplify prompt or retry with default parameters.',
  },
  video_model_not_available: {
    status: 404,
    message: 'Video model not found or unavailable',
    hint: 'The specified video model does not exist or is not currently available. Use "gpt-video-1" model.',
  },
  video_quota_exceeded: {
    status: 429,
    message: 'Video generation quota exceeded',
    hint: 'You have exceeded your video generation quota for this billing period. Upgrade your plan or wait for quota reset.',
  },

  // Video File Errors
  video_file_not_found: {
    status: 404,
    message: 'Video file not found',
    hint: 'The video ID does not exist or has been deleted. Verify the video ID is correct.',
  },
  video_download_failed: {
    status: 502,
    message: 'Failed to download video file',
    hint: 'Unable to download the video from OpenAI servers. Retry the download or check network connectivity.',
  },
  video_processing_failed: {
    status: 400,
    message: 'Video processing failed',
    hint: 'The video could not be processed. Check video.status_details for specific errors or verify generation parameters.',
  },
  invalid_video_parameters: {
    status: 400,
    message: 'Invalid video generation parameters',
    hint: 'One or more parameters are invalid. Check prompt (required), model (sora-2/sora-2-pro), seconds ("4"/"8"/"12"), and size (720x1280/1280x720/1024x1792/1792x1024).',
  },

  // Remix Errors
  remix_not_supported: {
    status: 400,
    message: 'Remix not available for this video',
    hint: 'The video cannot be remixed. Only completed videos with remix_enabled=true can be remixed.',
  },
  invalid_remix_parameters: {
    status: 400,
    message: 'Invalid remix configuration',
    hint: 'Remix parameters are invalid. Provide a valid video_id and optional new prompt. Ensure parent video supports remixing.',
  },
  remix_failed: {
    status: 500,
    message: 'Remix operation failed',
    hint: 'Internal error during video remix. Retry the operation or contact support if the issue persists.',
  },

  // Resource Errors
  video_limit_exceeded: {
    status: 429,
    message: 'Concurrent video generation limit exceeded',
    hint: 'You have reached the maximum number of concurrent video generation requests. Wait for in-progress videos to complete.',
  },
  remix_limit_exceeded: {
    status: 429,
    message: 'Remix operation limit exceeded',
    hint: 'You have exceeded the maximum number of remix operations. Wait before creating more remixes or upgrade your plan.',
  },
  invalid_video_duration: {
    status: 400,
    message: 'Invalid video duration',
    hint: 'The "seconds" parameter must be one of: "4", "8", or "12" (as string literals, not numbers). Choose a supported duration.',
  },

  // Additional Errors
  invalid_video_size: {
    status: 400,
    message: 'Invalid video size',
    hint: 'Supported video sizes are: "720x1280" (portrait), "1280x720" (landscape), "1024x1792" (hi-res portrait), "1792x1024" (hi-res landscape). Choose a supported size.',
  },
  video_content_policy_violation: {
    status: 400,
    message: 'Video violates content policy',
    hint: 'The generated video contains content that violates OpenAI usage policies. Modify the prompt and retry.',
  },
  video_expired: {
    status: 410,
    message: 'Video file has expired',
    hint: 'The video file is no longer available (expired after retention period). Generate a new video.',
  },
};

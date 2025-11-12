/**
 * Integration Tests: Multi-Step Workflow
 *
 * Tests complex workflows involving multiple sequential API calls:
 * - Multi-turn conversations with context continuity
 * - Create → Retrieve → Delete workflows
 * - Create → Cancel workflows
 * - Background response handling
 * - Error handling in multi-step scenarios
 * - State management across multiple requests
 *
 * These tests verify that the application correctly:
 * - Maintains conversation context across multiple turns
 * - Handles response lifecycle operations in sequence
 * - Manages state between dependent operations
 * - Recovers from errors in multi-step processes
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import OpenAI from 'openai';
import type { Responses } from 'openai/resources/responses';
import { ResponsesController } from '../../src/openai/controllers/responses.controller';
import { OpenAIResponsesService } from '../../src/openai/services/openai-responses.service';
import { LoggerService } from '../../src/common/services/logger.service';
import { OpenAIModule } from '../../src/openai/openai.module';
import { ConfigModule } from '@nestjs/config';
import configuration from '../../src/config/configuration';
import {
  createMockOpenAIResponse,
  createMockLoggerService,
} from '../../src/common/testing/test.factories';
import { CreateTextResponseDto } from '../../src/openai/dto/create-text-response.dto';

describe('Multi-Step Workflow Integration', () => {
  let module: TestingModule;
  let controller: ResponsesController;
  let service: OpenAIResponsesService;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockClient: jest.Mocked<OpenAI>;

  beforeAll(async () => {
    process.env.OPENAI_API_KEY = 'sk-test-multi-step-key';
    process.env.LOG_LEVEL = 'error';

    mockLoggerService = createMockLoggerService();

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          isGlobal: true,
        }),
        OpenAIModule,
      ],
    })
      .overrideProvider(LoggerService)
      .useValue(mockLoggerService)
      .compile();

    controller = module.get<ResponsesController>(ResponsesController);
    service = module.get<OpenAIResponsesService>(OpenAIResponsesService);
    mockClient = (service as any).client as jest.Mocked<OpenAI>;
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
    delete process.env.OPENAI_API_KEY;
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Multi-Turn Conversation Workflows', () => {
    it('should maintain conversation context across multiple turns', async () => {
      // Simulate a 3-turn conversation
      const conversationId = 'conv_multi_turn_123';

      // Turn 1: Initial question
      const turn1Dto: CreateTextResponseDto = {
        input: 'What is TypeScript?',
        conversation: conversationId,
        store: true,
      };

      const turn1Response = createMockOpenAIResponse({
        id: 'resp_turn1',
        output_text: 'TypeScript is a typed superset of JavaScript.',
        conversation: conversationId,
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(turn1Response);

      const result1 = await controller.createTextResponse(turn1Dto);
      expect(result1.id).toBe('resp_turn1');
      expect(result1.conversation).toBe(conversationId);

      // Turn 2: Follow-up question (uses same conversation ID)
      const turn2Dto: CreateTextResponseDto = {
        input: 'What are its benefits?',
        conversation: conversationId,
        previous_response_id: 'resp_turn1',
        store: true,
      };

      const turn2Response = createMockOpenAIResponse({
        id: 'resp_turn2',
        output_text: 'Benefits include type safety and better tooling.',
        conversation: conversationId,
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(turn2Response);

      const result2 = await controller.createTextResponse(turn2Dto);
      expect(result2.id).toBe('resp_turn2');
      expect(result2.conversation).toBe(conversationId);

      // Turn 3: Final question
      const turn3Dto: CreateTextResponseDto = {
        input: 'Can you give me an example?',
        conversation: conversationId,
        previous_response_id: 'resp_turn2',
        store: true,
      };

      const turn3Response = createMockOpenAIResponse({
        id: 'resp_turn3',
        output_text:
          'Here is a TypeScript example: interface User { name: string }',
        conversation: conversationId,
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(turn3Response);

      const result3 = await controller.createTextResponse(turn3Dto);
      expect(result3.id).toBe('resp_turn3');
      expect(result3.conversation).toBe(conversationId);

      // Verify all 3 API calls were made with conversation context
      expect(mockClient.responses.create).toHaveBeenCalledTimes(3);
      expect(mockClient.responses.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          conversation: conversationId,
          store: true,
        }),
      );
      expect(mockClient.responses.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          conversation: conversationId,
          previous_response_id: 'resp_turn1',
        }),
      );
      expect(mockClient.responses.create).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          conversation: conversationId,
          previous_response_id: 'resp_turn2',
        }),
      );
    });

    it('should handle conversation with different parameters per turn', async () => {
      const conversationId = 'conv_varying_params';

      // Turn 1: Low temperature for factual response
      const turn1Dto: CreateTextResponseDto = {
        input: 'What is the capital of France?',
        conversation: conversationId,
        temperature: 0.1,
        store: true,
      };

      const turn1Response = createMockOpenAIResponse({
        id: 'resp_factual',
        output_text: 'The capital of France is Paris.',
        conversation: conversationId,
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(turn1Response);

      await controller.createTextResponse(turn1Dto);

      // Turn 2: Higher temperature for creative response
      const turn2Dto: CreateTextResponseDto = {
        input: 'Write a poem about Paris',
        conversation: conversationId,
        previous_response_id: 'resp_factual',
        temperature: 0.9,
        store: true,
      };

      const turn2Response = createMockOpenAIResponse({
        id: 'resp_creative',
        output_text: 'In Paris, lights dance on the Seine...',
        conversation: conversationId,
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(turn2Response);

      await controller.createTextResponse(turn2Dto);

      // Verify different temperature values were used
      expect(mockClient.responses.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ temperature: 0.1 }),
      );
      expect(mockClient.responses.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ temperature: 0.9 }),
      );
    });
  });

  describe('Create → Retrieve → Delete Workflows', () => {
    it('should create response, retrieve it, then delete it successfully', async () => {
      const responseId = 'resp_lifecycle_test';

      // Step 1: Create response
      const createDto: CreateTextResponseDto = {
        input: 'Test lifecycle',
        store: true,
      };

      const createResponse = createMockOpenAIResponse({
        id: responseId,
        output_text: 'Lifecycle test response',
        status: 'completed',
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(createResponse);

      const created = await controller.createTextResponse(createDto);
      expect(created.id).toBe(responseId);
      expect(created.status).toBe('completed');

      // Step 2: Retrieve the response
      jest
        .spyOn(mockClient.responses, 'retrieve')
        .mockResolvedValueOnce(createResponse);

      const retrieved = await controller.retrieveResponse(responseId);
      expect(retrieved.id).toBe(responseId);
      expect(retrieved.output_text).toBe('Lifecycle test response');

      // Step 3: Delete the response
      const deleteResponse = {
        id: responseId,
        deleted: true,
        object: 'response' as const,
      };

      jest
        .spyOn(mockClient.responses, 'delete')
        .mockResolvedValueOnce(deleteResponse);

      const deleted = await controller.deleteResponse(responseId);
      expect(deleted.deleted).toBe(true);

      // Verify all 3 operations occurred
      expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
      expect(mockClient.responses.retrieve).toHaveBeenCalledTimes(1);
      expect(mockClient.responses.delete).toHaveBeenCalledTimes(1);
    });

    it('should handle retrieve failure after successful create', async () => {
      const responseId = 'resp_retrieve_fail';

      // Step 1: Create succeeds
      const createResponse = createMockOpenAIResponse({
        id: responseId,
        output_text: 'Created successfully',
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(createResponse);

      await controller.createTextResponse({ input: 'Test' });

      // Step 2: Retrieve fails (response not found)
      const notFoundError = new OpenAI.NotFoundError(
        404,
        {
          error: {
            message: 'Response not found',
            type: 'invalid_request_error',
            code: 'resource_not_found',
          },
        },
        'Response not found',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'retrieve')
        .mockRejectedValueOnce(notFoundError);

      await expect(controller.retrieveResponse(responseId)).rejects.toThrow(
        OpenAI.NotFoundError,
      );
    });

    it('should handle delete failure after successful retrieve', async () => {
      const responseId = 'resp_delete_fail';

      // Step 1: Create succeeds
      const createResponse = createMockOpenAIResponse({
        id: responseId,
        output_text: 'Test',
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(createResponse);

      await controller.createTextResponse({ input: 'Test' });

      // Step 2: Retrieve succeeds
      jest
        .spyOn(mockClient.responses, 'retrieve')
        .mockResolvedValueOnce(createResponse);

      await controller.retrieveResponse(responseId);

      // Step 3: Delete fails (permission error)
      const permissionError = new OpenAI.PermissionDeniedError(
        403,
        {
          error: {
            message: 'Permission denied',
            type: 'invalid_request_error',
            code: 'permission_denied',
          },
        },
        'Permission denied',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'delete')
        .mockRejectedValueOnce(permissionError);

      await expect(controller.deleteResponse(responseId)).rejects.toThrow(
        OpenAI.PermissionDeniedError,
      );
    });
  });

  describe('Create → Cancel Workflows', () => {
    it('should create in-progress response then cancel it', async () => {
      const responseId = 'resp_cancel_test';

      // Step 1: Create response (starts as in_progress)
      const createResponse = createMockOpenAIResponse({
        id: responseId,
        output_text: null,
        status: 'in_progress',
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(createResponse);

      const created = await controller.createTextResponse({
        input: 'Long running task',
        background: true,
      });

      expect(created.status).toBe('in_progress');

      // Step 2: Cancel the response
      const cancelResponse = createMockOpenAIResponse({
        id: responseId,
        output_text: null,
        status: 'cancelled',
      });

      jest
        .spyOn(mockClient.responses, 'cancel')
        .mockResolvedValueOnce(cancelResponse);

      const cancelled = await controller.cancelResponse(responseId);
      expect(cancelled.status).toBe('cancelled');

      expect(mockClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          background: true,
        }),
      );
      expect(mockClient.responses.cancel).toHaveBeenCalledWith(responseId);
    });

    it('should handle cancellation of already completed response', async () => {
      const responseId = 'resp_already_complete';

      // Step 1: Create and complete
      const completedResponse = createMockOpenAIResponse({
        id: responseId,
        output_text: 'Already completed',
        status: 'completed',
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(completedResponse);

      await controller.createTextResponse({ input: 'Fast task' });

      // Step 2: Try to cancel (but it's already complete)
      const cancelError = new OpenAI.APIError(
        400,
        {
          error: {
            message: 'Cannot cancel completed response',
            type: 'invalid_request_error',
            code: 'invalid_state',
          },
        },
        'Cannot cancel',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'cancel')
        .mockRejectedValueOnce(cancelError);

      await expect(controller.cancelResponse(responseId)).rejects.toThrow(
        OpenAI.APIError,
      );
    });
  });

  describe('Background Response Workflows', () => {
    it('should create background response and poll status until completion', async () => {
      const responseId = 'resp_background';

      // Step 1: Create background response
      const inProgressResponse = createMockOpenAIResponse({
        id: responseId,
        output_text: null,
        status: 'in_progress',
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(inProgressResponse);

      const created = await controller.createTextResponse({
        input: 'Long computation',
        background: true,
      });

      expect(created.status).toBe('in_progress');

      // Step 2: First poll - still in progress
      jest
        .spyOn(mockClient.responses, 'retrieve')
        .mockResolvedValueOnce(inProgressResponse);

      const poll1 = await controller.retrieveResponse(responseId);
      expect(poll1.status).toBe('in_progress');

      // Step 3: Second poll - now completed
      const completedResponse = createMockOpenAIResponse({
        id: responseId,
        output_text: 'Computation complete',
        status: 'completed',
      });

      jest
        .spyOn(mockClient.responses, 'retrieve')
        .mockResolvedValueOnce(completedResponse);

      const poll2 = await controller.retrieveResponse(responseId);
      expect(poll2.status).toBe('completed');
      expect(poll2.output_text).toBe('Computation complete');

      // Verify polling sequence
      expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
      expect(mockClient.responses.retrieve).toHaveBeenCalledTimes(2);
    });

    it('should handle background response failure', async () => {
      const responseId = 'resp_background_fail';

      // Step 1: Create background response
      const inProgressResponse = createMockOpenAIResponse({
        id: responseId,
        output_text: null,
        status: 'in_progress',
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(inProgressResponse);

      await controller.createTextResponse({
        input: 'Failing task',
        background: true,
      });

      // Step 2: Poll and find it failed
      const failedResponse = createMockOpenAIResponse({
        id: responseId,
        output_text: null,
        status: 'failed',
        incomplete_details: {
          reason: 'max_tokens',
        },
      });

      jest
        .spyOn(mockClient.responses, 'retrieve')
        .mockResolvedValueOnce(failedResponse);

      const result = await controller.retrieveResponse(responseId);
      expect(result.status).toBe('failed');
      expect(result.incomplete_details?.reason).toBe('max_tokens');
    });
  });

  describe('Parallel Workflow Operations', () => {
    it('should handle multiple concurrent response creations', async () => {
      // Create 3 responses concurrently
      const responses = [
        createMockOpenAIResponse({
          id: 'resp_parallel_1',
          output_text: 'Response 1',
        }),
        createMockOpenAIResponse({
          id: 'resp_parallel_2',
          output_text: 'Response 2',
        }),
        createMockOpenAIResponse({
          id: 'resp_parallel_3',
          output_text: 'Response 3',
        }),
      ];

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1])
        .mockResolvedValueOnce(responses[2]);

      const promises = [
        controller.createTextResponse({ input: 'Query 1' }),
        controller.createTextResponse({ input: 'Query 2' }),
        controller.createTextResponse({ input: 'Query 3' }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('resp_parallel_1');
      expect(results[1].id).toBe('resp_parallel_2');
      expect(results[2].id).toBe('resp_parallel_3');
      expect(mockClient.responses.create).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failure in concurrent operations', async () => {
      const successResponse = createMockOpenAIResponse({
        id: 'resp_success',
        output_text: 'Success',
      });

      const errorResponse = new OpenAI.APIError(
        500,
        {
          error: {
            message: 'Server error',
            type: 'api_error',
          },
        },
        'Server error',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(successResponse)
        .mockRejectedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const promises = [
        controller.createTextResponse({ input: 'Query 1' }),
        controller.createTextResponse({ input: 'Query 2' }),
        controller.createTextResponse({ input: 'Query 3' }),
      ];

      const results = await Promise.allSettled(promises);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');

      if (results[0].status === 'fulfilled') {
        expect(results[0].value.id).toBe('resp_success');
      }
      if (results[1].status === 'rejected') {
        expect(results[1].reason).toBeInstanceOf(OpenAI.APIError);
      }
    });
  });

  describe('Error Recovery in Multi-Step Workflows', () => {
    it('should retry failed step in workflow', async () => {
      const responseId = 'resp_retry_test';

      // Step 1: Create succeeds
      const createResponse = createMockOpenAIResponse({
        id: responseId,
        output_text: 'Created',
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(createResponse);

      await controller.createTextResponse({ input: 'Test' });

      // Step 2: First retrieve fails with timeout
      const timeoutError = new Error('Timeout') as Error & { code: string };
      timeoutError.code = 'ETIMEDOUT';

      jest
        .spyOn(mockClient.responses, 'retrieve')
        .mockRejectedValueOnce(timeoutError);

      await expect(controller.retrieveResponse(responseId)).rejects.toThrow(
        'Timeout',
      );

      // Step 3: Retry retrieve - succeeds
      jest
        .spyOn(mockClient.responses, 'retrieve')
        .mockResolvedValueOnce(createResponse);

      const retrieved = await controller.retrieveResponse(responseId);
      expect(retrieved.id).toBe(responseId);

      // Verify retry occurred
      expect(mockClient.responses.retrieve).toHaveBeenCalledTimes(2);
    });

    it('should handle cascading failures in workflow', async () => {
      const conversationId = 'conv_cascade_fail';

      // Turn 1: Succeeds
      const turn1Response = createMockOpenAIResponse({
        id: 'resp_turn1',
        conversation: conversationId,
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(turn1Response);

      await controller.createTextResponse({
        input: 'First turn',
        conversation: conversationId,
      });

      // Turn 2: Fails due to rate limit
      const rateLimitError = new OpenAI.APIError(
        429,
        {
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error',
            code: 'rate_limit_exceeded',
          },
        },
        'Rate limit exceeded',
        new Headers(),
      );

      jest
        .spyOn(mockClient.responses, 'create')
        .mockRejectedValueOnce(rateLimitError);

      await expect(
        controller.createTextResponse({
          input: 'Second turn',
          conversation: conversationId,
          previous_response_id: 'resp_turn1',
        }),
      ).rejects.toThrow(OpenAI.APIError);

      // Turn 3: After rate limit, retry succeeds
      const turn2Response = createMockOpenAIResponse({
        id: 'resp_turn2_retry',
        conversation: conversationId,
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(turn2Response);

      const result = await controller.createTextResponse({
        input: 'Second turn retry',
        conversation: conversationId,
        previous_response_id: 'resp_turn1',
      });

      expect(result.id).toBe('resp_turn2_retry');
    });
  });

  describe('Complex State Management', () => {
    it('should manage multiple conversation threads simultaneously', async () => {
      const conv1 = 'conv_thread_1';
      const conv2 = 'conv_thread_2';

      // Thread 1 - Turn 1
      const conv1Turn1 = createMockOpenAIResponse({
        id: 'resp_c1_t1',
        conversation: conv1,
        output_text: 'Thread 1 response',
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(conv1Turn1);

      await controller.createTextResponse({
        input: 'Thread 1 question',
        conversation: conv1,
      });

      // Thread 2 - Turn 1
      const conv2Turn1 = createMockOpenAIResponse({
        id: 'resp_c2_t1',
        conversation: conv2,
        output_text: 'Thread 2 response',
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(conv2Turn1);

      await controller.createTextResponse({
        input: 'Thread 2 question',
        conversation: conv2,
      });

      // Thread 1 - Turn 2
      const conv1Turn2 = createMockOpenAIResponse({
        id: 'resp_c1_t2',
        conversation: conv1,
        output_text: 'Thread 1 follow-up',
      });

      jest
        .spyOn(mockClient.responses, 'create')
        .mockResolvedValueOnce(conv1Turn2);

      await controller.createTextResponse({
        input: 'Thread 1 follow-up',
        conversation: conv1,
        previous_response_id: 'resp_c1_t1',
      });

      // Verify both threads maintained separate contexts
      expect(mockClient.responses.create).toHaveBeenCalledTimes(3);
      expect(mockClient.responses.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ conversation: conv1 }),
      );
      expect(mockClient.responses.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ conversation: conv2 }),
      );
      expect(mockClient.responses.create).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          conversation: conv1,
          previous_response_id: 'resp_c1_t1',
        }),
      );
    });
  });
});

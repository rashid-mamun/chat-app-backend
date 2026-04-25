const { messageValidation } = require('../../validators/chatValidator');
const { validationResult } = require('express-validator');

// Mock express-validator to unit test the middleware handleValidationErrors without a full express app
jest.mock('express-validator', () => {
    const actual = jest.requireActual('express-validator');
    return {
        ...actual,
        validationResult: jest.fn()
    };
});

describe('Chat Validator Utilities', () => {
    describe('handleValidationErrors middleware', () => {
        let req, res, next;
        
        beforeEach(() => {
            req = {};
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            next = jest.fn();
            validationResult.mockClear();
        });

        // The exact middleware is the second item in the messageValidation array
        const handleValidationErrors = messageValidation[1];

        it('should call next() if there are no validation errors', () => {
            validationResult.mockReturnValue({
                isEmpty: () => true
            });

            handleValidationErrors(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should return 400 with errors if validation fails', () => {
            const mockErrors = [{ msg: 'Message must be 1-1000 characters' }];
            validationResult.mockReturnValue({
                isEmpty: () => false,
                array: () => mockErrors
            });

            handleValidationErrors(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Validation failed',
                errors: mockErrors
            });
        });
    });
});

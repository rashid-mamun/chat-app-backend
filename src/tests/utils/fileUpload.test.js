const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Mock fs
jest.mock('fs', () => {
    const originalFs = jest.requireActual('fs');
    return {
        ...originalFs,
        existsSync: jest.fn(),
        mkdirSync: jest.fn()
    };
});

// Mock multer
jest.mock('multer', () => {
    const multerMock = jest.fn(() => ({
        any: jest.fn()
    }));
    multerMock.diskStorage = jest.fn();
    return multerMock;
});

describe('File Upload Utility', () => {
    let multerConfig;
    let storageConfig;

    beforeAll(() => {
        // Set existsSync to false so we can test both directory check and creation
        fs.existsSync.mockReturnValue(false);
        multer.diskStorage.mockReturnValue('mockedStorage');
        
        require('../../utils/fileUpload');
        
        if (multer.mock.calls.length > 0) {
            multerConfig = multer.mock.calls[0][0];
        }
        if (multer.diskStorage.mock.calls.length > 0) {
            storageConfig = multer.diskStorage.mock.calls[0][0];
        }
    });

    it('should create uploads directory if it does not exist', () => {
        expect(fs.existsSync).toHaveBeenCalled();
        expect(fs.mkdirSync).toHaveBeenCalledWith(
            expect.stringContaining('uploads'),
            { recursive: true }
        );
    });

    describe('Multer Configuration', () => {
        it('should use diskStorage with correct destination and filename logic', () => {
            expect(multerConfig.storage).toBe('mockedStorage');
            expect(storageConfig).toHaveProperty('destination');
            expect(storageConfig).toHaveProperty('filename');

            // Test destination function
            const destCb = jest.fn();
            storageConfig.destination(null, null, destCb);
            expect(destCb).toHaveBeenCalledWith(null, expect.stringContaining('uploads'));

            // Test filename function
            const nameCb = jest.fn();
            const file = { originalname: 'test.jpg' };
            
            // Mock Date.now to test predictable filenames
            const originalNow = Date.now;
            Date.now = jest.fn(() => 12345);
            
            storageConfig.filename(null, file, nameCb);
            expect(nameCb).toHaveBeenCalledWith(null, '12345-test.jpg');
            
            // Restore Date.now
            Date.now = originalNow;
        });

        it('should enforce 5MB file size limit', () => {
            expect(multerConfig.limits).toEqual({ fileSize: 5 * 1024 * 1024 });
        });

        describe('fileFilter', () => {
            it('should accept valid file types', () => {
                const cb = jest.fn();
                const validFiles = [
                    { originalname: 'test.jpg', mimetype: 'image/jpeg' },
                    { originalname: 'test.png', mimetype: 'image/png' },
                    { originalname: 'test.pdf', mimetype: 'application/pdf' },
                    { originalname: 'test.docx', mimetype: 'application/octet-stream' }
                ];

                validFiles.forEach(file => {
                    multerConfig.fileFilter(null, file, cb);
                    expect(cb).toHaveBeenCalledWith(null, true);
                });
            });

            it('should reject invalid file types', () => {
                const cb = jest.fn();
                const invalidFiles = [
                    { originalname: 'test.txt', mimetype: 'text/plain' },
                    { originalname: 'test.exe', mimetype: 'application/x-msdownload' }
                ];

                invalidFiles.forEach(file => {
                    multerConfig.fileFilter(null, file, cb);
                    expect(cb).toHaveBeenCalledWith(expect.any(Error));
                });
            });
        });
    });
});

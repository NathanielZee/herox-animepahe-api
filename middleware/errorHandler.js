class CustomError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
    }
}

const errorHandler = (err, req, res, next) => {
    const statusCode = (err.response?.status) || err.statusCode || 500;
    const message = err.message || 'Something went wrong';

    console.error(`Error: ${message} (Status Code: ${statusCode})`);

    const response = {
        status: statusCode,
        message: message
    };

    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
};

module.exports = {
    CustomError,
    errorHandler
};
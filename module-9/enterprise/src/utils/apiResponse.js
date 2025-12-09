class apiResponse {
    constructor(statusCode, message, data = null) {
        this.status= statusCode;
        this.message = message;
        this.data = data;
    }
}

module.exports = apiResponse;
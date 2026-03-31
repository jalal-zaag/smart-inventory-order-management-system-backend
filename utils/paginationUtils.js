// Pagination utility - creates standard paginated response format
const buildPaginatedResponse = (data, page, size, totalElements) => {
    const totalPages = Math.ceil(totalElements / size);

    return {
        content: data,
        empty: data.length === 0,
        first: page === 0,
        last: page >= totalPages - 1,
        number: page,
        numberOfElements: data.length,
        pageable: {
            sort: {
                sorted: true,
                unsorted: false,
                empty: false
            },
            pageNumber: page,
            pageSize: size,
            offset: page * size
        },
        size: size,
        sort: {
            sorted: true,
            unsorted: false,
            empty: false
        },
        totalElements: totalElements,
        totalPages: totalPages
    };
};

// Parse pagination params from request (0-based page)
const parsePaginationParams = (query) => {
    const page = Math.max(parseInt(query.page) || 0, 0);
    const size = Math.min(Math.max(parseInt(query.size) || 10, 1), 100);
    const skip = page * size;
    
    return { page, size, skip };
};

// Remove empty/null/undefined values from object
const removeEmptyKeys = (obj) => {
    const cleaned = {};
    Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value !== undefined && value !== null && value !== '' && value !== 'undefined' && value !== 'null') {
            cleaned[key] = value;
        }
    });
    return cleaned;
};

module.exports = {
    buildPaginatedResponse,
    parsePaginationParams,
    removeEmptyKeys
};

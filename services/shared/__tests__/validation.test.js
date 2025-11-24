/**
 * Validation Schema Tests
 * Tests for password strength, date ranges, NoSQL injection prevention, and input sanitization
 */

import { 
  authSchemas, 
  bookingSchemas, 
  propertySchemas, 
  searchSchemas,
  reviewSchemas,
  validateBody,
  validateQuery,
  sanitizeInput,
  sanitizeRequest
} from '../validation/schemas.js';

// Helper function to create mock function
const createMockFn = () => {
  const fn = (...args) => {
    fn.calls.push(args);
    return fn.returnValue;
  };
  fn.calls = [];
  fn.returnValue = undefined;
  fn.mockReturnThis = () => {
    fn.returnValue = fn;
    return fn;
  };
  return fn;
};

describe('Auth Validation Schemas', () => {
  describe('Password Strength Validation', () => {
    const testPassword = (password) => authSchemas.signup.validate({
      name: 'Test User',
      email: 'test@example.com',
      password,
      role: 'TRAVELER'
    });

    test('should reject password shorter than 8 characters', () => {
      const { error } = testPassword('Abc123!');
      expect(error).toBeDefined();
      expect(error.message).toContain('at least 8 characters');
    });

    test('should reject password without uppercase letter', () => {
      const { error } = testPassword('password123!');
      expect(error).toBeDefined();
      expect(error.message).toContain('uppercase');
    });

    test('should reject password without lowercase letter', () => {
      const { error } = testPassword('PASSWORD123!');
      expect(error).toBeDefined();
      expect(error.message).toContain('lowercase');
    });

    test('should reject password without number', () => {
      const { error } = testPassword('Password!@#$');
      expect(error).toBeDefined();
      expect(error.message).toContain('number');
    });

    test('should reject password without special character', () => {
      const { error } = testPassword('Password123');
      expect(error).toBeDefined();
      expect(error.message).toContain('special character');
    });

    test('should accept valid strong password', () => {
      const { error } = testPassword('SecurePass123!');
      expect(error).toBeUndefined();
    });

    test('should reject password longer than 128 characters', () => {
      const { error } = testPassword('A1!' + 'a'.repeat(126));
      expect(error).toBeDefined();
    });

    test('should accept password with all allowed special characters', () => {
      const specialChars = '@$!%*?&';
      for (const char of specialChars) {
        const { error } = testPassword(`Password123${char}`);
        expect(error).toBeUndefined();
      }
    });
  });

  describe('Email Validation', () => {
    test('should reject invalid email format', () => {
      const { error } = authSchemas.signup.validate({
        name: 'Test User',
        email: 'invalid-email',
        password: 'SecurePass123!',
        role: 'TRAVELER'
      });
      expect(error).toBeDefined();
      expect(error.message).toContain('valid email');
    });

    test('should accept valid email', () => {
      const { error } = authSchemas.signup.validate({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
        role: 'TRAVELER'
      });
      expect(error).toBeUndefined();
    });
  });

  describe('NoSQL Injection Prevention', () => {
    test('should sanitize MongoDB operators in email', () => {
      const { error, value } = authSchemas.login.validate({
        email: { $ne: null },
        password: 'password'
      }, { stripUnknown: true });
      
      // Joi will convert object to string or reject it
      expect(error).toBeDefined();
    });

    test('should sanitize MongoDB operators in password', () => {
      const { error } = authSchemas.login.validate({
        email: 'test@example.com',
        password: { $gt: '' }
      });
      
      expect(error).toBeDefined();
    });

    test('should reject array injection attempts', () => {
      const { error } = authSchemas.signup.validate({
        name: ['admin', 'user'],
        email: 'test@example.com',
        password: 'SecurePass123!',
        role: 'TRAVELER'
      });
      
      expect(error).toBeDefined();
    });
  });

  describe('Role Validation', () => {
    test('should accept TRAVELER role', () => {
      const { error } = authSchemas.signup.validate({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
        role: 'TRAVELER'
      });
      expect(error).toBeUndefined();
    });

    test('should accept OWNER role', () => {
      const { error } = authSchemas.signup.validate({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
        role: 'OWNER'
      });
      expect(error).toBeUndefined();
    });

    test('should reject invalid role', () => {
      const { error } = authSchemas.signup.validate({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
        role: 'ADMIN'
      });
      expect(error).toBeDefined();
    });
  });
});

describe('Booking Validation Schemas', () => {
  describe('Date Range Validation', () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    test('should reject check-in date in the past', () => {
      const { error } = bookingSchemas.create.validate({
        propertyId: '507f1f77bcf86cd799439011',
        startDate: yesterday.toISOString(),
        endDate: tomorrow.toISOString(),
        guests: 2
      });
      expect(error).toBeDefined();
      expect(error.message).toContain('must be today or later');
    });

    test('should reject check-out date before check-in date', () => {
      const { error } = bookingSchemas.create.validate({
        propertyId: '507f1f77bcf86cd799439011',
        startDate: nextWeek.toISOString(),
        endDate: tomorrow.toISOString(),
        guests: 2
      });
      expect(error).toBeDefined();
      expect(error.message).toContain('must be after check-in');
    });

    test('should reject check-out date same as check-in date', () => {
      const { error } = bookingSchemas.create.validate({
        propertyId: '507f1f77bcf86cd799439011',
        startDate: tomorrow.toISOString(),
        endDate: tomorrow.toISOString(),
        guests: 2
      });
      expect(error).toBeDefined();
    });

    test('should accept valid date range', () => {
      const { error } = bookingSchemas.create.validate({
        propertyId: '507f1f77bcf86cd799439011',
        startDate: tomorrow.toISOString(),
        endDate: nextWeek.toISOString(),
        guests: 2
      });
      expect(error).toBeUndefined();
    });

    test('should reject invalid ISO date format', () => {
      const { error } = bookingSchemas.create.validate({
        propertyId: '507f1f77bcf86cd799439011',
        startDate: '2024-13-45',
        endDate: nextWeek.toISOString(),
        guests: 2
      });
      expect(error).toBeDefined();
    });
  });

  describe('Guest Count Validation', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(tomorrow);
    nextWeek.setDate(nextWeek.getDate() + 7);

    test('should reject zero guests', () => {
      const { error } = bookingSchemas.create.validate({
        propertyId: '507f1f77bcf86cd799439011',
        startDate: tomorrow.toISOString(),
        endDate: nextWeek.toISOString(),
        guests: 0
      });
      expect(error).toBeDefined();
      expect(error.message).toContain('At least 1 guest');
    });

    test('should reject negative guests', () => {
      const { error } = bookingSchemas.create.validate({
        propertyId: '507f1f77bcf86cd799439011',
        startDate: tomorrow.toISOString(),
        endDate: nextWeek.toISOString(),
        guests: -1
      });
      expect(error).toBeDefined();
    });

    test('should reject more than 20 guests', () => {
      const { error } = bookingSchemas.create.validate({
        propertyId: '507f1f77bcf86cd799439011',
        startDate: tomorrow.toISOString(),
        endDate: nextWeek.toISOString(),
        guests: 21
      });
      expect(error).toBeDefined();
      expect(error.message).toContain('Maximum 20 guests');
    });

    test('should accept 1-20 guests', () => {
      for (let guests = 1; guests <= 20; guests++) {
        const { error } = bookingSchemas.create.validate({
          propertyId: '507f1f77bcf86cd799439011',
          startDate: tomorrow.toISOString(),
          endDate: nextWeek.toISOString(),
          guests
        });
        expect(error).toBeUndefined();
      }
    });
  });

  describe('Status Validation', () => {
    const validStatuses = ['PENDING', 'ACCEPTED', 'CANCELLED', 'COMPLETED'];
    
    validStatuses.forEach(status => {
      test(`should accept valid status: ${status}`, () => {
        const { error } = bookingSchemas.updateStatus.validate({ status });
        expect(error).toBeUndefined();
      });
    });

    test('should reject invalid status', () => {
      const { error } = bookingSchemas.updateStatus.validate({ status: 'INVALID' });
      expect(error).toBeDefined();
    });
  });
});

describe('Property Validation Schemas', () => {
  describe('Property Creation', () => {
    test('should reject title shorter than 5 characters', () => {
      const { error } = propertySchemas.create.validate({
        title: 'Home',
        type: 'House',
        description: 'A beautiful house in the city with modern amenities',
        city: 'New York',
        country: 'USA',
        pricePerNight: 100,
        maxGuests: 4
      });
      expect(error).toBeDefined();
    });

    test('should reject description shorter than 3 characters', () => {
      const { error } = propertySchemas.create.validate({
        title: 'Beautiful Home',
        type: 'House',
        description: 'Wi',
        city: 'New York',
        country: 'USA',
        pricePerNight: 100,
        maxGuests: 4
      });
      expect(error).toBeDefined();
    });

    test('should default maxGuests to 1 when omitted', () => {
      const { error, value } = propertySchemas.create.validate({
        title: 'Beautiful Home',
        type: 'House',
        description: 'Cozy space perfect for short stays',
        city: 'New York',
        country: 'USA',
        pricePerNight: 100
      });
      expect(error).toBeUndefined();
      expect(value.maxGuests).toBe(1);
    });

    test('should reject invalid property type', () => {
      const { error } = propertySchemas.create.validate({
        title: 'Beautiful Home',
        type: 'Castle',
        description: 'A beautiful house in the city with modern amenities',
        city: 'New York',
        country: 'USA',
        pricePerNight: 100,
        maxGuests: 4
      });
      expect(error).toBeDefined();
    });

    test('should reject negative price', () => {
      const { error } = propertySchemas.create.validate({
        title: 'Beautiful Home',
        type: 'House',
        description: 'A beautiful house in the city with modern amenities',
        city: 'New York',
        country: 'USA',
        pricePerNight: -1,
        maxGuests: 4
      });
      expect(error).toBeDefined();
    });

    test('should reject price over 100000', () => {
      const { error } = propertySchemas.create.validate({
        title: 'Beautiful Home',
        type: 'House',
        description: 'A beautiful house in the city with modern amenities',
        city: 'New York',
        country: 'USA',
        pricePerNight: 100001,
        maxGuests: 4
      });
      expect(error).toBeDefined();
    });

    test('should limit amenities array to 50 items', () => {
      const amenities = Array(51).fill('WiFi');
      const { error } = propertySchemas.create.validate({
        title: 'Beautiful Home',
        type: 'House',
        description: 'A beautiful house in the city with modern amenities',
        city: 'New York',
        country: 'USA',
        pricePerNight: 100,
        maxGuests: 4,
        amenities
      });
      expect(error).toBeDefined();
    });

    test('should limit photos array to 20 items', () => {
      const photos = Array(21).fill('https://example.com/photo.jpg');
      const { error } = propertySchemas.create.validate({
        title: 'Beautiful Home',
        type: 'House',
        description: 'A beautiful house in the city with modern amenities',
        city: 'New York',
        country: 'USA',
        pricePerNight: 100,
        maxGuests: 4,
        photos
      });
      expect(error).toBeDefined();
    });

    test('should reject invalid photo URL', () => {
      const { error } = propertySchemas.create.validate({
        title: 'Beautiful Home',
        type: 'House',
        description: 'A beautiful house in the city with modern amenities',
        city: 'New York',
        country: 'USA',
        pricePerNight: 100,
        maxGuests: 4,
        photos: ['not-a-url']
      });
      expect(error).toBeDefined();
    });

    test('should accept valid property data', () => {
      const { error } = propertySchemas.create.validate({
        title: 'Beautiful Home',
        type: 'House',
        description: 'A beautiful house in the city with modern amenities',
        city: 'New York',
        country: 'USA',
        pricePerNight: 100,
        maxGuests: 4,
        amenities: ['WiFi', 'Kitchen'],
        photos: ['https://example.com/photo.jpg']
      });
      expect(error).toBeUndefined();
    });
  });

  describe('NoSQL Injection Prevention in Property Search', () => {
    test('should sanitize maxGuests injection attempt', () => {
      const { error } = propertySchemas.create.validate({
        title: 'Beautiful Home',
        type: 'House',
        description: 'A beautiful house in the city with modern amenities',
        city: 'New York',
        country: 'USA',
        pricePerNight: 100,
        maxGuests: { $gt: 0 }
      });
      expect(error).toBeDefined();
    });

    test('should sanitize pricePerNight injection attempt', () => {
      const { error } = propertySchemas.create.validate({
        title: 'Beautiful Home',
        type: 'House',
        description: 'A beautiful house in the city with modern amenities',
        city: 'New York',
        country: 'USA',
        pricePerNight: { $lte: 1000 },
        maxGuests: 4
      });
      expect(error).toBeDefined();
    });
  });
});

describe('Review Validation Schemas', () => {
  test('should reject rating outside 1-5', () => {
    const { error } = reviewSchemas.create.validate({
      rating: 6,
      comment: 'Great stay',
      bookingId: 'abc123'
    });
    expect(error).toBeDefined();
  });

  test('should require bookingId', () => {
    const { error } = reviewSchemas.create.validate({
      rating: 5,
      comment: 'Wonderful stay'
    });
    expect(error).toBeDefined();
  });

  test('should accept valid review payload', () => {
    const { error, value } = reviewSchemas.create.validate({
      rating: 4,
      comment: 'Relaxing visit with responsive host',
      bookingId: 'booking123'
    });
    expect(error).toBeUndefined();
    expect(value.rating).toBe(4);
  });
});

describe('Search Validation Schemas', () => {
  describe('Price Range Validation', () => {
    test('should reject negative minPrice', () => {
      const { error } = searchSchemas.properties.validate({
        minPrice: -1
      });
      expect(error).toBeDefined();
    });

    test('should reject maxPrice less than minPrice', () => {
      const { error } = searchSchemas.properties.validate({
        minPrice: 100,
        maxPrice: 50
      });
      expect(error).toBeDefined();
    });

    test('should accept valid price range', () => {
      const { error } = searchSchemas.properties.validate({
        minPrice: 50,
        maxPrice: 200
      });
      expect(error).toBeUndefined();
    });
  });

  describe('Pagination Validation', () => {
    test('should reject page less than 1', () => {
      const { error } = searchSchemas.properties.validate({
        page: 0
      });
      expect(error).toBeDefined();
    });

    test('should reject limit greater than 100', () => {
      const { error } = searchSchemas.properties.validate({
        limit: 101
      });
      expect(error).toBeDefined();
    });

    test('should set default page to 1', () => {
      const { value } = searchSchemas.properties.validate({});
      expect(value.page).toBe(1);
    });

    test('should set default limit to 20', () => {
      const { value } = searchSchemas.properties.validate({});
      expect(value.limit).toBe(20);
    });
  });

  describe('Search Date Range', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    test('should reject endDate before startDate', () => {
      const { error } = searchSchemas.properties.validate({
        startDate: tomorrow.toISOString(),
        endDate: yesterday.toISOString()
      });
      expect(error).toBeDefined();
    });

    test('should accept valid date range', () => {
      const nextWeek = new Date(tomorrow);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const { error } = searchSchemas.properties.validate({
        startDate: tomorrow.toISOString(),
        endDate: nextWeek.toISOString()
      });
      expect(error).toBeUndefined();
    });
  });
});


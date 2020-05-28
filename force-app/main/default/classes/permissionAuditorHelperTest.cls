@IsTest
private class permissionAuditorHelperTest {
    @IsTest
    static void test_getListOfSObjects() {
        Test.startTest();
        List<String> listOfSobjectsTest = permissionAuditorHelper.getListOfSObjects();
        Test.stopTest();

        System.assertNotEquals(0, listOfSobjectsTest.size());
    }

    @IsTest
    static void test_getMapOfFieldsByObject() {
        Test.startTest();
        Map<String, permissionAuditorHelper.objField> mapOfFieldsByObjectTest = permissionAuditorHelper.getMapOfFieldsByObject('Account');
        Test.stopTest();

        System.assertNotEquals(0, mapOfFieldsByObjectTest.keySet().size());
        System.assert(mapOfFieldsByObjectTest.containsKey('Id'));
    }

    @IsTest
    static void test_getSObjectDataFromQueryString_good_query() {
        Map<String, Object> submitQuery = new Map<String, Object>();
        submitQuery.put('queryString', 'SELECT Id FROM User WHERE isActive = True');

        Test.startTest();
        List<User> users = (List<User>) permissionAuditorHelper.getSObjectDataFromQueryString(JSON.serialize(submitQuery));
        Test.stopTest();

        System.assertNotEquals(0, users.size());

    }

    @IsTest
    static void test_getSObjectDataFromQueryString_missing_query() {
        Map<String, Object> submitQuery = new Map<String, Object>();
        submitQuery.put('query', 'SELECT Id FROM User WHERE isActive = True');
        String errorMessage;

        Test.startTest();
        try {
            List<User> users = (List<User>) permissionAuditorHelper.getSObjectDataFromQueryString(JSON.serialize(submitQuery));
        } catch (Exception e) {
            errorMessage = e.getMessage();
        }
        Test.stopTest();

        System.assertEquals('Error - Missing Query!', errorMessage);
    }

    @IsTest
    static void test_getSObjectDataFromQueryString_malformed_query() {
        Map<String, Object> submitQuery = new Map<String, Object>();
        submitQuery.put('queryString', 'SELECT Id FROM User WHERE isActive ');
        String errorMessage;

        Test.startTest();
        try {
            List<User> users = (List<User>) permissionAuditorHelper.getSObjectDataFromQueryString(JSON.serialize(submitQuery));
        } catch (Exception e) {
            errorMessage = e.getMessage();
        }
        Test.stopTest();

        System.assert(String.isNotEmpty(errorMessage));
    }

}
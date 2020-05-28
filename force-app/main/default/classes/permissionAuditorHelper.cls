public with sharing class permissionAuditorHelper {

    @AuraEnabled(Cacheable=true)
    public static List<String> getListOfSObjects() {
        List<String> listOfSobjects = new List<String>();

        for (Schema.SObjectType ob : Schema.getGlobalDescribe().values()) {
            String name = ob.getDescribe().getName();
            if (!name.containsIgnoreCase('history')
                    && !name.containsIgnoreCase('tag')
                    && !name.containsIgnoreCase('share')
                    && !name.containsIgnoreCase('feed')
                    && ob.getDescribe().isSearchable()
                    && ob.getDescribe().isUpdateable()) {
                listOfSobjects.add(name);
            }
        }

        listOfSobjects.sort(); // Sort
        return listOfSobjects;
    }

    @AuraEnabled(Cacheable=true)
    public static Map<String, objField> getMapOfFieldsByObject(String sObjectName) {

        List<String> specialReadFieldsList = new List<String>{
                'Id', 'CreatedById', 'CreatedDate', 'IsDeleted', 'LastModifiedById', 'LastModifiedDate', 'SystemModstamp'
        };
        List<String> specialReadWriteFieldsList = new List<String>{
                'OwnerId'
        };

        SObjectType selectedObjectType = Schema.getGlobalDescribe().get(sObjectName);
        Map<String, Schema.SObjectField> fields = selectedObjectType.getDescribe().fields.getMap();

        Map<String, objField> fieldMap = new Map<String, objField>();

        for (Schema.SObjectField field : fields.values()) {
            // Ignore all compound fields and only display fields that have permissions
            //  && field.getDescribe().permissionable == true
            Schema.DescribeFieldResult r = field.getDescribe();

            if (r.getCompoundFieldName() == null) {

                objField objFieldMap = new objField();
                objFieldMap.name = r.getName();
                objFieldMap.relationshipName = r.getRelationshipName();
                objFieldMap.label = r.getLabel();
                objFieldMap.type = String.valueOf(r.getType());
                objFieldMap.isNameField = r.isNameField();
                objFieldMap.isNillable = r.isNillable();
                objFieldMap.isAccessible = r.isAccessible();
                objFieldMap.isCreateable = r.isCreateable();
                objFieldMap.isUpdateable = r.isUpdateable();
                objFieldMap.isAutoNumber = r.isAutoNumber();
                objFieldMap.permissionable = r.isPermissionable();
                objFieldMap.isCustom = r.isCustom();
                objFieldMap.isCalculated = r.isCalculated();

                if (specialReadFieldsList.contains(r.getName())) {
                    objFieldMap.isSpecialField = true;
                    objFieldMap.specialRead = true;
                }

                if (specialReadWriteFieldsList.contains(r.getName())) {
                    objFieldMap.isSpecialField = true;
                    objFieldMap.specialRead = true;
                    objFieldMap.specialEdit = true;
                }

                fieldMap.put(r.getName(), objFieldMap);
            }
        }

        return fieldMap;
    }

    @AuraEnabled(Cacheable=true)
    public static List<SObject> getSObjectDataFromQueryString(String jsonRequest) {
        // Adapted from James Hou @tsalb
        // https://github.com/tsalb/lwc-utils/blob/master/force-app/main/default/classes/DataTableServiceTests.cls

        Map<String, Object> request = (Map<String, Object>) JSON.deserializeUntyped(jsonRequest);
        if (request.containsKey('queryString') == false) {
            AuraHandledException err = new AuraHandledException('Error - Missing Query!');
            err.setMessage('Error - Missing Query!');
            throw err;
        }
        try {
            System.debug('getSObjectDataFromQueryString queryString is: ' + request.get('queryString'));
            return Database.query((String) request.get('queryString'));
        } catch (Exception e) {
            AuraHandledException err = new AuraHandledException('Something went wrong with query! ' + e.getMessage());
            err.setMessage('Something went wrong with query! ' + e.getMessage());
            throw err;
        }

    }

    public class objField {
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String relationshipName { get; set; }
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public String type { get; set; }
        @AuraEnabled public Boolean isNameField { get; set; }
        @AuraEnabled public Boolean isNillable { get; set; }
        @AuraEnabled public Boolean isAccessible { get; set; }
        @AuraEnabled public Boolean isCreateable { get; set; }
        @AuraEnabled public Boolean isUpdateable { get; set; }
        @AuraEnabled public Boolean isAutoNumber { get; set; }
        @AuraEnabled public Boolean permissionable { get; set; }
        @AuraEnabled public Boolean isCustom { get; set; }
        @AuraEnabled public Boolean isCalculated { get; set; }
        @AuraEnabled public Boolean isSpecialField = false;
        @AuraEnabled public Boolean specialRead = false;
        @AuraEnabled public Boolean specialEdit = false;

    }

}
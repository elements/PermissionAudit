import {track, wire, LightningElement} from 'lwc';
import getListOfSObjects from '@salesforce/apex/permissionAuditorHelper.getListOfSObjects';
import getMapOfFieldsByObject from '@salesforce/apex/permissionAuditorHelper.getMapOfFieldsByObject';
import getSObjectDataFromQueryString from '@salesforce/apex/permissionAuditorHelper.getSObjectDataFromQueryString';

const fieldPermissionColumnsBase = [
    {label: 'Field', fieldName: 'fieldName'},
    {label: 'Type', fieldName: 'type'},
]; // Since we dynamically generate columns - this is base

const profileQuerySOQL = 'SELECT Id, Name FROM Profile';


export default class ObjectProfileAuditor extends LightningElement {
    // Form props
    sObjectOptions = [];
    selectedObject;

    profileOptions = [];
    selectedProfiles = [];

    // Spinner
    isLoading = false;

    // Permissions
    fieldMap;
    fieldPermission;
    listOfFields = [];
    listOfProfiles = [];

    // Field Datatable
    @track fieldsData = [];
    @track fieldPermissionColumns = [...fieldPermissionColumnsBase]; // Load with Base

    // Reactive Field Permission Query
    get fieldPermissionQuery() {
        return this._fieldPermissionQuery;
    }

    set fieldPermissionQuery(value) {
        this.isLoading = true;
        this._fieldPermissionQuery = value;
    }

    _fieldPermissionQuery;

    // Wire sObjects
    @wire(getListOfSObjects)
    wiredSObjects(result) {
        if (result.error) {
            console.error(result.error);
        }

        if (result.data) {
            this._sObjects = result.data;
            this.sObjectOptions = this._sObjects.map(elm => ({value: elm, label: elm}));

        }
    }

    // Wire sObject Fields
    // Reactive prop $selectedObject
    @wire(getMapOfFieldsByObject, {sObjectName: '$selectedObject'})
    wiredFields(result) {
        if (result.error) {
            console.error(result.error);
        }

        if (result.data) {
            this.fieldMap = result.data;
            this.listOfFields = Object.keys(result.data);
        }

    }

    // Wire Profiles
    @wire(getSObjectDataFromQueryString, {
        jsonRequest: JSON.stringify({
            queryString: profileQuerySOQL
        })
    })
    wiredProfiles(result) {
        if (result.error) {
            console.error(result.error);
        }

        if (result.data) {
            this.listOfProfiles = result.data.reduce((profile, curr) => {
                profile[curr.Name] = curr
                return profile;
            }, {});

            this.profileOptions = result.data.map(elm => ({value: elm.Name, label: elm.Name}));
        }

    }

    // Wire Field Permissions
    @wire(getSObjectDataFromQueryString, {jsonRequest: '$_fieldPermissionQuery'})
    wireFieldPermissions(result) {
        if (result.error) {
            console.error(result.error);
        }

        if (result.data) {
            // Transform data to group Field permission by Profile
            this.fieldPermission = this._groupFieldPermissionsByProfileName(result.data);

            // Timeout for bit due to UI draw issues when wire has cached data
            // We use settimeout to slow down to allow UI to catch up before firing the merge data
            new Promise((resolve) => {
                // eslint-disable-next-line @lwc/lwc/no-async-operation
                setTimeout(() => {
                    this.mergeData();
                }, 0);
                resolve();
            }).finally(() => (this.isLoading = false));
        }

    }

    // Return object of Profiles and their field permissions
    // This is adding field permissions so not every single field is returned
    _groupFieldPermissionsByProfileName = (permissionData) => {
        return permissionData.reduce((profile, curr) => {
            if (!profile[curr.Parent.Profile.Name]) profile[curr.Parent.Profile.Name] = {
                fields: {},
                name: curr.Parent.Profile.Name,
                id: curr.Parent.ProfileId
            }; // Initialize Parent.Profile.Name doesnt exist
            let fieldName = curr.Field.split('.')[1]; // Split since API lists as "Object.Field"
            profile[curr.Parent.Profile.Name].fields[fieldName] = {...curr, fieldName: fieldName}
            return profile;
        }, {});
    }

    // The Good stuff
    // Here we merge the sObject fields with base layer of permissions of false and add on permissions
    mergeData() {
        // Loop Fields
        let data = [];

        this.listOfFields.forEach(field => {
            // Generate Base Permissions
            let perms = {};
            Object.keys(this.listOfProfiles).forEach(profile => {
                // Initialize with false
                perms[`${this.listOfProfiles[profile].Id}-read`] = false;
                perms[`${this.listOfProfiles[profile].Id}-write`] = false;

                // Layer Profile Permissions
                if (this.fieldPermission[profile] && {}.hasOwnProperty.call(this.fieldPermission[profile].fields, field)) {
                    perms[`${this.listOfProfiles[profile].Id}-read`] = this.fieldPermission[profile].fields[field].PermissionsRead;
                    perms[`${this.listOfProfiles[profile].Id}-write`] = this.fieldPermission[profile].fields[field].PermissionsEdit;
                }

                // Layer Special Fields
                // Should be last in line
                if (this.fieldMap[field].isSpecialField) {
                    perms[`${this.listOfProfiles[profile].Id}-read`] = this.fieldMap[field].specialRead;
                    perms[`${this.listOfProfiles[profile].Id}-write`] = this.fieldMap[field].specialEdit;
                }
            });

            // Merge Fields & Perms & Push
            data.push({
                fieldName: `${this.fieldMap[field].label} (${this.fieldMap[field].name})`,
                type: this.fieldMap[field].type,
                ...perms
            });

        });

        this.fieldsData = data;
    }

    // sObject combobox change
    // Update the fields and permissions
    handleObjectChange(evt) {
        this.selectedObject = evt.detail.value;

        // Clear table
        this.fieldsData = [];

        // Get Permissions for Object Field
        this.fieldPermissionQuery = JSON.stringify({
            queryString: `SELECT Id, Field, PermissionsEdit, PermissionsRead, ParentId, Parent.Profile.Name, Parent.ProfileId
                    FROM FieldPermissions
                    WHERE SObjectType = '${this.selectedObject}' AND Parent.IsOwnedByProfile = true`
        });

    }

    // Profiles changed or reordered. lets rerender the datatable with correct column headers
    handleProfilesChange(evt) {
        this.selectedProfiles = evt.detail.value;

        // Setup base columns
        let columns = [...fieldPermissionColumnsBase];

        // Loop Profiles to add R/W columns per profile
        this.selectedProfiles.forEach(profile => {
            columns.push(
                {label: `${profile} - Read`, fieldName: `${this.listOfProfiles[profile].Id}-read`, type: 'boolean'},
                {label: `${profile} - Write`, fieldName: `${this.listOfProfiles[profile].Id}-write`, type: 'boolean'}
            )
        });
        // Set Columns
        this.fieldPermissionColumns = columns;

    }

}